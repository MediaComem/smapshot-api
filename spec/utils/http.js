const { mapKeys } = require('lodash');

/**
 * Normalizes HTTP header names to lowercase.
 *
 *     normalizeHttpHeaders({ accept: 'application/json', 'Content-Type': 'application/json' })
 *     // { accept: 'application/json', 'content-type': 'application/json' }
 *
 * @param {Object.<string, string>} headers - The headers to normalize.
 * @returns {Object.<string, string>} The normalized headers.
 */
exports.normalizeHttpHeaders = headers => {
  return mapKeys(headers, property => property.toLowerCase());
};
