const httpStatusCodes = require('http-status-codes');

/**
 * Convenience function to quickly create an HTTP problem details object
 * (https://tools.ietf.org/html/rfc7807).
 *
 *     httpProblemDetails(500, 'Oops');
 *     // { type: 'https://httpstatuses.com/500', title: 'Internal Server Error', detail: 'Oops', status: 500 }
 *
 *     httpProblemDetails(500, 'Oops', { custom: 'property' });
 *     // { type: 'https://httpstatuses.com/500', title: 'Internal Server Error', detail: 'Oops', status: 500, custom: 'property' }
 *
 * @param {number} status - The HTTP status of the response
 * @param {string} detail - A human-readable explanation specific to this
 * occurrence of the problem.
 * @param {Object} properties - Extra HTTP problem details properties or custom
 * properties.
 * @param {string} [type] - A URI reference that identifies the problem type.
 * Defaults to "https://httpstatuses.com/XYZ" where XYZ is the HTTP status of
 * the response.
 * @param {string} [title] - A short, human-readable summary of the problem
 * type. It SHOULD NOT change from occurrence to occurrence of the problem,
 * except for purposes of localization. Defaults to the standard status text for
 * the HTTP status of the response.
 * @param {string} [instance] - A URI reference that identifies the specific
 * occurrence of the problem. It may or may not yield further information if
 * dereferenced.
 * @returns {Object} An HTTP problem details object.
 */
exports.httpProblemDetails = (status, detail, properties = {}) => {

  const { type, title, status: _ignored_status, detail: _ignored_detail, instance, ...extraProperties } = properties;

  return {
    type: type || `https://httpstatuses.com/${status}`,
    title: title || httpStatusCodes.getStatusText(status),
    status,
    detail,
    instance,
    ...extraProperties
  };
};
