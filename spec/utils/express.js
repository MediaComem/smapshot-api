const { isFunction } = require('lodash');

/**
 * Indicates whether the specified value is an Express application.
 *
 * @param {*} app - The value to check.
 * @returns {boolean} True if the value is an Express application.
 */
exports.isExpressApplication = app => {
  return isFunction(app) && isFunction(app.use) && isFunction(app.get) && isFunction(app.set) && isFunction(app.get) && isFunction(app.post);
};
