const axios = require('axios');
const config = require('../../config');

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

const generateUrlFromIIIFSize_info = async (size_info_url, width) => {
    const { data } = await axios.get(size_info_url);
    const size = getClosestSize(data.sizes, width)
    return data.id + "/full/" + size.width + "," + size.height + "/0/default.jpg";
}

const getImageMediaUrlFromIIIFSize_info = async (media, size_info_url, width) => {
    media.image_url = await generateUrlFromIIIFSize_info(size_info_url, width)
    return;
}

const isIIIFLevel0 = (iiif_data) => {
  return iiif_data && iiif_data.size_info;
}

exports.generateImageUrl = async (media, image_id, collection_id, iiif_data, region, image_width, image_height, iiifLevel0_width ) => {
    if (!image_height) {
        image_height = '';
    }
    //iiif image
    if (isIIIFLevel0(iiif_data) && iiifLevel0_width) {
        await Promise.all([getImageMediaUrlFromIIIFSize_info(media, iiif_data.size_info, iiifLevel0_width)]);
    } else if (iiif_data && region) {
        media.image_url = `${iiif_data.image_service3_url}/${region[0]},${region[1]},${region[2]},${region[3]}/${image_width},${image_height}/0/default.jpg`;
    } else if (iiif_data) {
        media.image_url = `${iiif_data.image_service3_url}/full/${image_width},${image_height}/0/default.jpg`;
    //not iiif image
    } else {
        media.image_url = `${config.apiUrl}/data/collections/${collection_id}/images/${image_width}/${image_id}.jpg`;
    }

    return media.image_url
}

exports.generateImageTiles = (image_id, collection_id, iiif_data) => {
    const tiles = {};
    if (iiif_data) {
        tiles.type = 'iiif';
        tiles.url = `${iiif_data.image_service3_url}/info.json`;
    } else {
        tiles.type = 'dzi';
        tiles.url = `${config.apiUrl}/data/collections/${collection_id}/images/tiles/${image_id}.dzi`;
    }
    
    return tiles
}

exports.generateGltfUrl = (image_id, collection_id, region) => {
    let model_3d_url;
    if (region) {
        model_3d_url = `${config.apiUrl}/data/collections/${collection_id}/gltf/${image_id}_${region[0]}_${region[1]}_${region[2]}_${region[3]}.gltf`;
    } else {
        model_3d_url = `${config.apiUrl}/data/collections/${collection_id}/gltf/${image_id}.gltf`;
    }

    return model_3d_url
}

exports.retrieveMediaBannerUrl = async (media, size_info_url, width) => {
    media.banner_url = await generateUrlFromIIIFSize_info(size_info_url, width)
    return;
}

exports.isIIIFLevel0 = isIIIFLevel0;