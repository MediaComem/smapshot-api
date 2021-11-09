const axios = require('axios');

const getClosestSize = (sizes, width) => {
    const closest = { 'position': 0, 'diff': null };
    sizes.forEach((size, index) => {
        const diff = Math.abs(width - size.width);
        if (closest.diff === null || closest.diff > diff) {
            closest.diff = diff
            closest.position = index
        }
    });
    return sizes[closest.position];
}

const generateUrl = async (size_info_url, width) => {
    const { data } = await axios.get(size_info_url);
    const size = getClosestSize(data.sizes, width)
    return data.id + "/full/" + size.width + "," + size.height + "/0/default.jpg";
}

exports.retrieveMediaBannerUrl = async (media, size_info_url, width) => {
    media.banner_url = await generateUrl(size_info_url, width)
    return;
}

exports.getImageMediaUrl = async (media, size_info_url, width) => {
    media.image_url = await generateUrl(size_info_url, width)
    return;
}

exports.isIIIFLevel0 = (iiif_data) => {
  return iiif_data && iiif_data.size_info;
}
