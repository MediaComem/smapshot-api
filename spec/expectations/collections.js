const { compactObject } = require('../utils/fixtures');

/**
 * Returns the expected collection JSON from the API for a given database row.
 *
 * @param {Object} collection - The collection database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @param {(boolean|number)} [options.banner_id] - The expected banner ID, or
 * true to automatically expect the ID of the associated banner image, or false
 * to expect no banner ID.
 * @param {(boolean|Object)} [options.owner] - The expected owner object, or
 * true to automatically expect an owner object based on the associated owner,
 * or false to expect no owner object.
 * @returns {Object} The expected API collection.
 */
exports.getExpectedCollection = (
  { date_publi, description, id, link, name, owner, banner_id },
  options = {}
) => {
  const {
    locale: locale,
    owner: expectedOwner,
    media: expectedMedia,
    thumbnailsDirectory: expectedThumbnailsDirectory,
    ...extraProperties
  } = options;

  const expectedLocale = locale || 'en';

  const expected = {
    ...extraProperties,
    id,
    link,
    date_publi: date_publi ? date_publi.toISOString() : null,
    description: description[expectedLocale],
    name: name[expectedLocale]
  };

  if (expectedOwner === true || expectedOwner === undefined) {
    expected.owner = {
      id: owner.id,
      name: owner.name[expectedLocale],
      slug: owner.slug
    };
  }

  if (expectedMedia === true || expectedMedia === undefined) {
    expected.media = {
      banner_url: `http://localhost:1337/data/collections/${id}/images/${expectedThumbnailsDirectory || '500'}/${banner_id}.jpg`
    };
  } else if (expectedMedia !== false) {
    expected.media = expectedMedia;
  }

  return compactObject(expected);
};
