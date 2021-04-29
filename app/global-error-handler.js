const { ApiError } = require('./utils/errors');
const { getLogger } = require('./utils/express');
const { httpProblemDetails } = require('./utils/http-problem-details');

const expectedErrors = [
  // Request validation errors, e.g. path params, query params, headers.
  // Everything except the body.
  400,
  // Authentication errors.
  401,
  // Authorization errors.
  403,
  // Not Found errors
  404,
  // Request body validation errors.
  422
];

/**
 * The global Express error handler for this project. Most errors should end up
 * here and be serialized in our standard error format.
 *
 * @param {Error} err - The error that occurred.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {Function} _next - The Express next function.
 */
module.exports = (err, req, res, _next) => {

  // Determine the response status from the error if possible.
  const status = typeof err.status === 'number' ? err.status : 500;

  // Log errors. Some errors are logged at the verbose level since they are
  // expected to occur during normal operation.
  if (expectedErrors.includes(status)) {
    getLogger(req).verbose(err);
  } else {
    getLogger(req).error(err);
  }

  let headers = {};
  let body;
  if (err instanceof ApiError) {
    // If the error is an instance of our custom API error, it will indicate the
    // headers and body to send to the client.
    headers = err.headers;
    body = err.body;
  } else {
    // Otherwise, send a generic HTTP problem details object. DO NOT send the
    // error message of an unexpected error to the client; it may contain
    // sensitive information (e.g. database queries).
    headers['Content-Type'] = 'application/problem+json; charset=utf-8';
    body = httpProblemDetails(status, 'An unexpected error occurred');
  }

  // Send a JSON response to the client.
  res.status(status).set(headers).send(body);
};
