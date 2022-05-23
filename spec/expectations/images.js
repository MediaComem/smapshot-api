const { expect } = require('../utils/chai');
const { compactObject } = require('../utils/fixtures');

/**
 * Returns the expected image JSON from the API for a given database row.
 *
 * @param {Object} image - The image database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API correction.
 */
exports.getExpectedImage = (image, options = {}) => {
  const { id, owner_id, collection_id, width, height, latitude, longitude,
    date_shot, date_georef, date_shot_min, date_shot_max, is_published, collection } = image;
  const {
    media: expectedMedia,
    ...extraProperties
  } = options;

  const mainAttributes = getMainAttributes(image);
  const expected = {
    ...extraProperties,
    ...mainAttributes,
    is_published,
    owner_id,
    collection_id,
    width, height,
    date_georef: date_georef === null ? null : date_georef.toISOString().slice(0,10),
    // The latitude and longitude returned by the API are computed and may not
    // be exactly equal to the original values from the fixtures.
    latitude: latitude === null ? null : actual => expect(actual).to.be.closeToWithPrecision(latitude),
    longitude: longitude === null ? null : actual => expect(actual).to.be.closeToWithPrecision(longitude),
    date_shot_min: date_shot ? date_shot.toISOString().slice(0,10) : date_shot_min.toISOString().slice(0,10),
    date_shot_max: date_shot ? date_shot.toISOString().slice(0,10) : date_shot_max.toISOString().slice(0,10)
  }

  if (expectedMedia === undefined) {
    expected.media = {
      image_url: `http://localhost:1337/data/collections/${collection_id}/images/thumbnails/${id}.jpg`
    };
  } else if (expectedMedia !== false) {
    expected.media = expectedMedia;
  }

  expected.collection = {
    id: collection.id,
    date_publi: collection.date_publi === null ? null : collection.date_publi.toISOString(), 
  };

  return compactObject(expected);
};

/**
 * Returns the expected image JSON from the API for a given database row.
 *
 * @param {Object} image - The image database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API correction.
 */
exports.getExpectedImageMetadata = (image, options = {}) => {
  const { owner_id, collection_id, caption, geotags_array, link, latitude, longitude } = image;
  const {
    ...extraProperties
  } = options;

  const mainAttributes = getMainAttributes(image);
  const expected = {
    ...extraProperties,
    ...mainAttributes,
    owner_id,
    collection_id,
    caption,
    geotags_array,
    link,
    latitude,
    longitude
  };

  return compactObject(expected);
};

/**
 * Returns the expected image attributes JSON from the API for a given database row.
 *
 * @param {Object} image - The image database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API correction.
 */
exports.getExpectedImageAttributes = (image, options = {}) => {
  const { id, is_published, caption, link, download_link, shop_link, view_type, correction_enabled, license,
          date_shot, date_shot_min, date_shot_max, width, height,
          owner, collection, photographers, user,
          latitude, longitude, roll, tilt, altitude, azimuth, country_iso_a2, focal,
          observation_enabled,
          framing_mode, geolocalisation_id
        } = image;
  const {
    media: expectedMedia,
    locale,
    ...extraProperties
  } = options;

  const expectedLocale = locale || 'en';

  const mainAttributes = getMainAttributes(image);
  const expected = {
    ...extraProperties,
    ...mainAttributes,
    is_published,
    caption,
    link, download_link, shop_link,
    view_type,
    correction_enabled,
    license,
    width, height,
    date_shot_min: date_shot ? date_shot.toISOString().slice(0,10) : date_shot_min.toISOString().slice(0,10),
    date_shot_max: date_shot ? date_shot.toISOString().slice(0,10) : date_shot_max.toISOString().slice(0,10),
    observation_enabled,
    nObs: 0,
    framing_mode
  };

  expected.pose = {
    latitude, longitude, roll, tilt, altitude, azimuth, country_iso_a2, focal, 
    geolocalisation_id, 
    gltf_url: null, 
    regionByPx: null
  },

  expected.owner = {
    id: owner.id,
    name: owner.name[expectedLocale],
    slug: owner.slug,
    link: owner.link
  };

  expected.collection = {
    id: collection.id,
    name: collection.name[expectedLocale],
    link: collection.link,
    date_publi: collection.date_publi === null ? null : collection.date_publi.toISOString()
  };

  if (framing_mode === 'composite_image') {
    expected.poses = [];
  }

  photographers.forEach(function expectedPhotographer(photographer) {
    const first_name = photographer.first_name?`${photographer.first_name} ` :'';
    const last_name = photographer.last_name? photographer.last_name : '';
    const company = photographer.company? `, ${photographer.company}` : '';
    
    photographer.name = first_name + last_name + company;
    delete photographer.first_name;
    delete photographer.last_name;
    delete photographer.company;
  });
  expected.photographers = photographers;

  expected.georeferencer = user ? {
    id: user.id,
    username: user.username
  } : null;

  if (expectedMedia === true || expectedMedia === undefined) {
    expected.media = {
      image_url: `http://localhost:1337/data/collections/${collection.id}/images/thumbnails/${id}.jpg`,
      tiles: {
        type: 'dzi',
        url: `http://localhost:1337/data/collections/${collection.id}/images/tiles/${id}.dzi`
      }
    };
    if (expected.state === 'waiting_validation' || expected.state === 'validated') {
      expected.media.model_3d_url = `http://localhost:1337/data/collections/${expected.collection.id}/gltf/${expected.id}.gltf`;
    }

  } else if (expectedMedia !== false) {
    expected.media = expectedMedia;
  }

  return compactObject(expected);
};


/**
 * Builds expected image attributes from the PUT/POST image request
 * Returns the expected image attributes JSON from the API for a given database row.
 *
 * @param {Object} request - The PUT/POST request
 * @param {Object} [options] - Additional attributes not available in the request.
 * @returns {Object} The expected API correction.
 */
exports.getExpectedRequestedImageAttributes = (request, options) => {

  const { is_published, caption, link, download_link, shop_link, view_type, 
    date_shot, date_shot_min, date_shot_max
  } = request.body;

  const requestBody = request.body;

  const {
    locale,
  } = options;
  const expectedLocale = locale || 'en';

  const unrequiredAttributes = {
    is_published,
    caption,
    link, download_link, shop_link,
    view_type,
    date_shot, date_shot_min, date_shot_max,
    nObs: 0,
    locked: false,
    locked_user_id: null, 
    delta_last_start: null,
    georeferencer: null,
    pose: {
      altitude: null, latitude: null, longitude: null, azimuth: null, tilt: null, roll: null, country_iso_a2: null, focal: null, 
      geolocalisation_id: null, gltf_url: null, regionByPx: null
    }
  };

  const expected = {
    ...requestBody,
    ...unrequiredAttributes,
    ...options
  };

  if (expected.framing_mode === 'composite_image') {
    expected.poses = [];
  }

  //photographers
  options.photographers.forEach(function expectedPhotographer(photographer) {
    const first_name = photographer.first_name?`${photographer.first_name} ` :'';
    const last_name = photographer.last_name? photographer.last_name : '';
    const company = photographer.company? `, ${photographer.company}` : '';
    
    photographer.name = first_name + last_name + company;
    delete photographer.first_name;
    delete photographer.last_name;
    delete photographer.company;
  });
  expected.photographers = options.photographers;
  delete expected.photographer_ids;

  //owner
  expected.owner = {
    id: options.owner.id,
    name: options.owner.name[expectedLocale],
    slug: options.owner.slug,
    link: options.owner.link
  };

  //collection
  expected.collection = {
    id: options.collection.id,
    name: options.collection.name[expectedLocale],
    link: options.collection.link,
    date_publi: options.collection.date_publi === null ? null : options.collection.date_publi.toISOString()
  };
  delete expected.collection_id;

  //a priori locations
  if (expected.apriori_location) {
    expected.apriori_altitude =  expected.apriori_location.altitude;
    expected.apriori_locations = [{
      longitude: expected.apriori_location.longitude, 
      latitude: expected.apriori_location.latitude, 
      azimuth: expected.apriori_location.azimuth ? expected.apriori_location.azimuth : null, 
      exact:  expected.apriori_location.exact ? expected.apriori_location.exact : false
    }]
    delete expected.apriori_location;

    //state
    expected.state = expected.apriori_locations[0].exact ? 'waiting_alignment' : 'initial';
  }

  //media
  if (requestBody.iiif_data) {
    const region = requestBody.iiif_data.regionByPx ? requestBody.iiif_data.regionByPx : "full";
    expected.media = { 
      image_url: expected.iiif_data.image_service3_url + "/" + region + "/200,/0/default.jpg",
      tiles: { type: 'iiif', url: expected.iiif_data.image_service3_url + "/info.json"},
    };
    if (expected.state === 'waiting_validation' || expected.state === 'validated') {
      expected.media.model_3d_url = `http://localhost:1337/data/collections/${expected.collection.id}/gltf/${expected.id}.gltf`;
    }
    if (requestBody.iiif_data.regionByPx) {
      //return regionByPx only if not null 
      expected.media.regionByPx = requestBody.iiif_data.regionByPx;
    }
    delete expected.iiif_data;
  }

  //date
  if (expected.date_shot) {
    expected.date_shot_min = expected.date_shot;
    expected.date_shot_max = expected.date_shot;
  }
  delete expected.date_shot;

  delete expected.date_orig;
  delete expected.name;

  Object.keys(expected).forEach((property) => expected[property] === undefined ? expected[property] = null : expected[property] );

  return compactObject(expected);
};

function getMainAttributes({ id, original_id, title, state }) {

  const expected = {
    id,
    original_id,
    title,
    state
  };
  return expected;
}
