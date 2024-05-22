const { compactObject } = require('../utils/fixtures');
const config = require("../../config");

/**
 * Returns the expected owner JSON from the API for a given database row.
 *
 * @param {Object} owner - The owner database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @param {(boolean|number)} [options.banner_id] - The expected banner ID, or
 * true to automatically expect the ID of the associated banner image, or false
 * to expect no banner ID.
 * @returns {Object} The expected API collection.
 */
exports.getExpectedOwner = (
  { id, link, slug, name, description, extent, banner_col_id, banner_id },
  options = {}
) => {
  const {
    locale: locale,
    media: expectedMedia,
    thumbnailsDirectory: expectedThumbnailsDirectory,
    ...extraProperties
  } = options;

  const expectedLocale = locale || config.langFallback;

  const expected = {
    ...extraProperties,
    id,
    link,
    slug,
    extent,
    description: description[expectedLocale],
    name: name[expectedLocale],

  };

  if (expectedMedia === true || expectedMedia === undefined) {
    expected.media = {
      banner_url: `http://localhost:1337/data/collections/${banner_col_id}/images/${expectedThumbnailsDirectory || '500'}/${banner_id}.jpg`
    };
  } else if (expectedMedia !== false) {
    expected.media = expectedMedia;
  }

  return compactObject(expected);
};
