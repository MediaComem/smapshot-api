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
    date_shot, date_georef, date_shot_min, date_shot_max, is_published } = image;
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
          owner, collection, photographer, user,
          latitude, longitude, roll, tilt, altitude, azimuth, country_iso_a2, focal,
          observation_enabled
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
    nObs: 0
  };

  expected.pose = {
    latitude, longitude, roll, tilt, altitude, azimuth, country_iso_a2, focal
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
    link: collection.link
  };

  expected.photographer = photographer ? {
    id: photographer.id,
    name: photographer.name[expectedLocale],
    link: photographer.link
  } : null;

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
  } else if (expectedMedia !== false) {
    expected.media = expectedMedia;
  }

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
