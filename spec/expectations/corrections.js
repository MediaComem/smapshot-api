const { compactObject } = require('../utils/fixtures');

/**
 * Returns the expected correction JSON from the API for a given database row.
 *
 * @param {Object} correction - The correction database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API correction.
 */
exports.getExpectedCorrection = (
  { id, state, date_created, remark, correction, type, image },
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
    correction,
    type,
    date_created: date_created.toISOString(),
    image: {
      id: image.id,
      original_id: image.original_id,
      title: image.title,
      caption: image.caption,
      orig_title: image.orig_title,
      orig_caption: image.orig_caption,
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
