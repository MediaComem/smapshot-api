const { compactObject } = require('../utils/fixtures');

/**
 * Returns the expected observation JSON from the API for a given database row.
 *
 * @param {Object} observation - The observation database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API observation.
 */
exports.getExpectedObservation = (
  { id, state, date_created, remark, observation, image },
  options = {}
) => {
  const {
    locale: locale,
    media: expectedMedia,
    ...extraProperties
  } = options;

  const expectedLocale = locale || 'en';

  const expected = {
    ...extraProperties,
    id,
    state,
    remark,
    observation,
    date_created: date_created.toISOString().slice(0,10),
    image: {
      id: image.id,
      name: image.name,
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
