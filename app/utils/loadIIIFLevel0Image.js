const axios = require('axios');

const getClosest = (data, width) => {
    const closest = { 'position': 0, 'diff': null };
    data.sizes.forEach((size, index) => {
        const diff = Math.abs(width - size.width);
        if (closest.diff === null || closest.diff > diff) {
            closest.diff = diff
            closest.position = index
        }
    });
    return closest.position;
}

const generateUrl = async (url, width) => {
    const { data } = await axios.get(url);
    const index = getClosest(data, width)
    return data.id + "/full/" + data.sizes[index].width + "," + data.sizes[index].height + "/0/default.jpg";
}

exports.getUrlOnBanner = async (media, url, width) => {
    media.banner_url = await generateUrl(url, width)
    return;
}

exports.getUrlOnImage = async (media, url, width) => {
    media.image_url = await generateUrl(url, width)
    return;
}