const { compactObject } = require('../utils/fixtures');
const config = require("../../config");

/**
 * Returns the expected observation JSON from the API for a given database row.
 *
 * @param {Object} observation - The observation database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API observation.
 */
exports.getExpectedMeObservation = (
  { id, state, date_created, remark, observation, image },
  options = {}
) => {
  const {
    locale: locale,
    media: expectedMedia,
    ...extraProperties
  } = options;

  const expectedLocale = locale || config.langFallback;

  const expected = {
    ...extraProperties,
    id,
    state,
    remark,
    observation,
    date_created: date_created.toISOString().slice(0,10),
    image: {
      id: image.id,
      original_id: image.original_id,
      title: image.title,
      owner: {
        id: image.owner.id,
        name: image.owner.name[expectedLocale]
      },
      collection: {
        id: image.collection.id,
        name: image.collection.name[expectedLocale]
      }
    }
  };

  if (expectedMedia === undefined) {
    expected.image.media = {
      image_url: `http://localhost:1337/data/collections/${image.collection.id}/images/500/${image.id}.jpg`
    };
  } else if (expectedMedia !== false) {
    expected.image.media = expectedMedia;
  }
  return compactObject(expected);
};

exports.getExpectedObservation = (
  { coord_x, coord_y, width, height, id, observation, date_created, state, date_validated, download_timestamp, remark, image, user, validator },
  options = {}
) => {
  const {
    locale: locale,
    media: expectedMedia,
    remark: expectedRemark,
    validator: expectedValidator,
    ...extraProperties
  } = options;

  const expectedLocale = locale || config.langFallback;

  const expected = {
    ...extraProperties,
    coord_x,
    coord_y,
    width,
    height,
    id,
    observation,
    date_created: date_created.toISOString().slice(0,10),
    state,
    date_validated: date_validated === null ? null : date_validated.toISOString(), 
    download_timestamp: download_timestamp.toISOString(),
    image: {
      id: image.id,
      original_id: image.original_id,
      title: image.title,
      is_published: image.is_published,
      owner: {
        name: image.owner.name[expectedLocale]
      },
      collection: {
        id: image.collection.id,
        name: image.collection.name[expectedLocale]
      }
    },
    volunteer: {
      id: user.id,
      username: user.username
    }
  };

  if (expectedValidator) {
    if (state === "validated" || state === "rejected" ) {
      expected.validator = {
        id: validator.id,
        username: validator.username
      };
    } else {
      expected.validator = null
    }
  }

  if (expectedRemark) {
    expected.remark = remark;
  }

  if (expectedMedia === undefined) {
    expected.image.media = {
      image_url: `http://localhost:1337/data/collections/${image.collection.id}/images/500/${image.id}.jpg`,
      tiles: {
        type: "dzi",
        url: `http://localhost:1337/data/collections/${image.collection.id}/images/tiles/${image.id}.dzi`
      }
    };
  } else if (expectedMedia !== false) {
    expected.image.media = expectedMedia;
  }

  return compactObject(expected);
};
