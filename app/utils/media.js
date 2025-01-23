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

const setImageUrl = async (media, image_id, collection_id, iiif_data, image_width, image_height ) => {
    if (!image_height) {
        image_height = '';
    }
    //iiif image
    if (isIIIFLevel0(iiif_data)) {
        await getImageMediaUrlFromIIIFSize_info(media, iiif_data.size_info, image_width);
    } else if (iiif_data && iiif_data.regionByPx) {
        const region = iiif_data.regionByPx;
        media.image_url = `${iiif_data.image_service3_url}/${region[0]},${region[1]},${region[2]},${region[3]}/${image_width},${image_height}/0/default.jpg`;
    } else if (iiif_data) {
        media.image_url = `${iiif_data.image_service3_url}/full/${image_width},${image_height}/0/default.jpg`;
    //not iiif image
    } else {
        const image_width_imageUrl = image_width === 200 ? 'thumbnails' : image_width;
        media.image_url = `${config.apiUrl}/data/collections/${collection_id}/images/${image_width_imageUrl}/${image_id}.jpg`;
    }
}

//shortcut method
exports.setImageUrl = async (image, image_width, image_height) => {
    if (!image || !image.id || !image.collection_id || !image_width) {
        throw new Error(`Image_id, collection_id or image_width is missing. Image_width: ${image_width}. Image: ${image}`);
    }
    return setImageUrl(image.media, image.id, image.collection_id, image.iiif_data, image_width, image_height)
}

//shortcut method for setting image_url on a list of images
exports.setListImageUrl = async (elements, image_width, image_height) => {
    const mediaRetrieval = [];
    for (const element of elements) {
        let image;
        if (element.image) {
            image = element.image.dataValues;
        } else if (element.dataValues.image) {
            image = element.dataValues.image.dataValues;
        } else {
            image = element.dataValues;
        }

        const collection_id = image.collection ? image.collection.id : image.collection_id;

        if (!image || !image.id || !collection_id || !image_width) {
            throw new Error(`Image_id, collection_id or image_width is missing. Image_width: ${image_width}. Image: ${image}`);
        }

        image.media = {};

        mediaRetrieval.push(setImageUrl(image.media, image.id, collection_id, image.iiif_data, image_width, image_height));
    }
    await Promise.all(mediaRetrieval)
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

exports.generateGltfUrl = (image_id, collection_id, region, isTemp = false, improveFromVisit=false) => {
    let model_3d_url;
    if (region) {
        model_3d_url = `${config.apiUrl}/data/collections/${collection_id}/gltf/${image_id}_${region[0]}_${region[1]}_${region[2]}_${region[3]}${isTemp ? '_temp' : ''}${improveFromVisit ? '_visit' : ''}.gltf`;
    } else {
        model_3d_url = `${config.apiUrl}/data/collections/${collection_id}/gltf/${image_id}${isTemp ? '_temp' : ''}${improveFromVisit ? '_visit' : ''}.gltf`;
    }

    return model_3d_url
}

exports.setIIIFLevel0BannerUrl = async (media, size_info_url, width) => {
    media.banner_url = await generateUrlFromIIIFSize_info(size_info_url, width)
    return;
}

exports.isIIIFLevel0 = isIIIFLevel0;
