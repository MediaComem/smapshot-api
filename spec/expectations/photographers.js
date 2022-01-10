const { compactObject } = require('../utils/fixtures');

/**
 * Returns the expected photographer JSON from the API for a given database row.
 *
 * @param {Object} photographer - The photographer database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @returns {Object} The expected API observation.
 */
exports.getExpectedPhotographer = (
  { id, first_name, last_name, link, company },
  options = {}
) => {
  const {
    ...extraProperties
  } = options;

  const expected = {
    ...extraProperties,
    id,
    first_name,
    last_name,
    link,
    company
  };

  return compactObject(expected);
};
