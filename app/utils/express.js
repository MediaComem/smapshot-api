const logger = require('../../config/logger');

/**
 * Creates a JavaScript Error object intended to indicate an API-related error.
 * By default, it has an additional `status` property that defaults to 500 (as
 * in HTTP 500 Internal Server Error). This property can be used in an Express
 * error-handling middleware to set the HTTP response's status.
 *
 * Additional properties (including `status`) can be passed as an object to the
 * second argument of this function.
 *
 * @example
 * throw createApiError('Oops', {
 *   status: 422,
 *   myCustomProperty: 'value'
 * });
 *
 * @param {String} message - The error message.
 * @param {Object} [properties] - Additional properties to set on the error object.
 * @param {Object} [properties.status] - The status the HTTP response should have when this error is thrown.
 * @returns {Error}
 */
exports.createApiError = (message, properties = {}) => {
  return Object.assign(new Error(message), {
    ...properties,
    status: properties.status || 500
  });
};

/**
 * Returns the logger associated with the specified request, if any. Otherwise
 * returns the main application logger.
 *
 * @param {express.Request} req - The Express request object.
 * @returns {winston.Logger} A logger.
 */
exports.getLogger = req => req ? req.logger || logger : logger;

/**
 * Awaits the result of an asynchronous operation (in the form of a promise) and
 * throws an API error if it fails.
 *
 * @example
 * res.send(await handlePromise(databaseQuery, {
 *   message: 'Could not retrieve stuff from the database',
 *   status: 418
 * }));
 *
 * @param {Promise} promise - The promise to await.
 * @param {Object} apiErrorOptions - Options to create the API error if the promise is
 * rejected (can contain any custom properties to attach to the API error object
 * in addition to `message` and `status`).
 * @param {String} apiErrorOptions.message - The message of the API error.
 * @param {Object} [apiErrorOptions.status] - The status the HTTP response should have
 * when the error is thrown.
 * @param {Function} [isValid] - A custom function to determine whether the result of the promise is valid (it should return true or false).
 * @returns {Promise} A promise that will be resolved with the same result as
 * the provided promise, or rejected with an API error if the provided promise
 * is rejected.
 */
exports.handlePromise = async (
  promise,
  apiErrorOptions = {},
  isValid = () => true
) => {
  if (!apiErrorOptions.message) {
    throw new Error(
      "The handlePromise function must be passed a 'message' option"
    );
  }

  try {
    const result = await promise;

    const validationResult = isValid(result);
    if (!validationResult) {
      throw new Error("Result is invalid");
    }

    return result;
  } catch (err) {
    logger.error(err);
    throw exports.createApiError(apiErrorOptions.message, apiErrorOptions);
  }
};

/**
 * Wraps an async/await function into an Express-compatible middleware function.
 * The wrapped function will receive the same arguments as a normal Express
 * middleware (i.e. `req`, `req` and `next`). Additionally, if the promise is
 * rejected (e.g. an error is thrown), `next` will automatically be called with
 * the error.
 *
 * This is necessary if you want to use async/await function and forward thrown
 * errors to an Express error-handling middleware. Express can only detect
 * errors in a middleware function if the function is synchronous or if the
 * error is passed to `next`. Therefore it cannot detect the rejection of an
 * async/await function unless it is wrapped with this function.
 *
 * @example
 * exports.myMiddleware = route(async (req, res) => {
 *   // You can use await. Any thrown error will be caught by Express.
 *   await doAsyncStuff();
 *   // You can throw an error. It will be caught by Express.
 *   throw new Error('Oops');
 * });
 *
 * @param {Function} routeFunc - An async/await Express middleware.
 * @returns {Function} An Express-compatible middleware function that handles async/await errors.
 */
exports.route = routeFunc => {
  // Return an Express-compatible middleware function (asynchronous but without async/await).
  return (req, res, next) => {
    // Start a promise chain.
    Promise.resolve()
      // Call the async/await middleware-like function.
      .then(() => routeFunc(req, res, next))
      // Call `next` if the promise is rejected (e.g. an error is thrown).
      // eslint-disable-next-line promise/no-callback-in-promise
      .catch(next);
  };
};
