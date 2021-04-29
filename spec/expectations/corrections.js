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
      name: image.name,
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

  return compactObject(expected);
};
