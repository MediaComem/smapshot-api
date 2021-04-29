const httpStatusCodes = require('http-status-codes');
const { isString } = require('lodash');
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');

const { httpProblemDetails } = require('./http-problem-details');

/**
 * An API-related error which encapsulates the information that should be sent
 * to the client in an HTTP response.
 */
class ApiError extends Error {
  /**
   * Constructs an API error.
   *
   * @param {number} status - The HTTP response status.
   * @param {string} message - The error message (for server logs, not sent in
   * the response).
   * @param {*} body - The response body.
   * @param {Object.<string, string>} headers - The headers to set in the
   * response.
   */
  constructor(status, message, body, headers = {}) {
    super(`API ${status} ${httpStatusCodes.getStatusText(status)} error: ${message}`);

    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);

    this.status = status;
    this.headers = headers;
    this.body = body;
  }
}

/**
 * An API error represented as a standard HTTP problem details object.
 */
class HttpProblemDetailsError extends ApiError {
  /**
   * Constructs an HTTP problem details error.
   *
   * @param {number} status - The HTTP response status.
   * @param {string} detail - A human-readable explanation specific to this
   * occurrence of the problem. This will be sent in the response as the
   * `detail` member of the HTTP problem details object (see
   * https://tools.ietf.org/html/rfc7807#section-3.1).
   * @param {Object.<string, *>} properties - Additional properties to include
   * in the response body for custom errors (see
   * https://tools.ietf.org/html/rfc7807#section-3.2).
   */
  constructor(status, detail, properties = {}) {
    super(status, detail, httpProblemDetails(status, detail, properties), { 'Content-Type': 'application/problem+json; charset=utf-8' });
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

exports.ApiError = ApiError;
exports.HttpProblemDetailsError = HttpProblemDetailsError;

/**
 * Creates an authentication error. It will be returned to the API client as an
 * HTTP 401 Unauthorized response by the global error handler.
 *
 * @param {string} detail - A human-readable explanation specific to this
 * occurrence of the problem. This will be sent in the response.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.authenticationError = detail => new HttpProblemDetailsError(401, detail);

/**
 * Creates an authorization error. It will be returned to the API client as an
 * HTTP 403 Forbidden response by the global error handler.
 *
 * @param {string} detail - A human-readable explanation specific to this
 * occurrence of the problem. This will be sent in the response.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.authorizationError = detail => new HttpProblemDetailsError(403, detail);

/**
 * Creates a not found error. It will be returned to the API client as an HTTP
 * 404 Not found response by the global error handler.
 *
 * @param {express.Request} req - The Express request object.
 * @param {string} [detail] - A human-readable explanation specific to this
 * occurrence of the problem. This will be sent in the response.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.notFoundError = (req, detail) => new HttpProblemDetailsError(404, detail || req.__('general.resourceNotFound'));

/**
 * Creates an error indicating invalid request parameters (HTTP headers, URL
 * query parameters or URL path parameters). It will be returned to the API
 * client as an HTTP 400 Bad Request response by the global error handler.
 *
 * @param {express.Request} req - The Express request object.
 * @param {Object[]} errors - The problems found in the parameters.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.requestParametersValidationError = (req, errors) => new HttpProblemDetailsError(400, req.__('general.validationErrors'), { errors });

/**
 * Creates an error indicating an invalid request body. It will be returned to
 * the API client as an HTTP 422 Unprocessable Entity response by the global
 * error handler.
 *
 * @param {express.Request} req - The Express request object.
 * @param {Object[]} errors - The problems found in the request body.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.requestBodyValidationError = (req, errors) => new HttpProblemDetailsError(422, req.__('general.validationErrors'), { errors });

/**
 * Creates an error resulting from the violation of a foreign key database
 * constraint, i.e. attempting to reference a row that does not exist. It will
 * be returned to the client as an HTTP 422 Unprocessable Entity response using
 * our standard validation error format by the global error handler.
 *
 * @param {express.Request} req - The Express request object.
 * @param {sequelize.ForeignKeyConstraintError} err - The constraint error
 * thrown by sequelize.
 * @param {string} bodyProperty - The request body property containing the
 * invalid reference.
 * @param {string} description - A description of the associated entity which
 * will be included into the error message (e.g. "image", "user").
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.foreignKeyConstraintError = (req, err, bodyProperty, description) => {
  if (!(err instanceof ForeignKeyConstraintError)) {
    throw new Error('Error must be a ForeignKeyConstraintError from sequelize');
  } else if (!isString(bodyProperty)) {
    throw new Error(`Property must be a string but its type is ${typeof bodyProperty}`);
  } else if (!isString(description)) {
    throw new Error(`Description must be a string but its type is ${typeof description}`);
  }

  const id = req.body[bodyProperty];
  if (id === undefined) {
    throw new Error(`Request body ${JSON.stringify(req.body)} has no property ${bodyProperty}`);
  }

  return new HttpProblemDetailsError(422, req.__('general.validationErrors'), {
    errors: [
      {
        location: 'body',
        message: `Could not find ${description} ${id}`,
        path: `/${bodyProperty}`,
        validation: 'unknownReference'
      }
    ]
  });
};

/**
 * Creates an error resulting from the violation of a unique database
 * constraint. It will be returned to the API client as an HTTP 422
 * Unprocessable Entity response by the global error handler.
 *
 * Call this method with a UniqueConstraintError thrown by sequelize. Its
 * contents will be serialized to our standard error format.
 *
 * @param {string} detail - A human-readable explanation specific to this
 * occurrence of the problem. This will be sent in the response.
 * @param {sequelize.UniqueConstraintError} err - The unique constraint error
 * thrown by sequelize.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.uniqueConstraintError = (detail, err) => {
  if (!(err instanceof UniqueConstraintError)) {
    throw new Error('Error must be a UniqueConstraintError from sequelize');
  }

  return new HttpProblemDetailsError(422, detail, {
    errors: serializeUniqueConstraintError(err)
  });
};

/**
 * Creates a general error. It will be returned to the API client as an HTTP 500
 * Internal Server Error response by the global error handler.
 *
 * WARNING: the detail message MUST NOT contain sensitive information since it
 * will be sent in the response.
 *
 * @param {string} detail - A human-readable explanation specific to this
 * occurrence of the problem. This will be sent in the response.
 * @returns {HttpProblemDetailsError} An error that can be thrown or passed to
 * Express's `next` function.
 */
exports.unexpectedError = detail => new HttpProblemDetailsError(500, detail);

/**
 * Indicates whether the error passed as the first argument is a violation of a
 * unique database constraint for the specified column.
 *
 * @param {*} err - The error thrown by sequelize.
 * @param {string} column - The column.
 * @returns {boolean} True if the error matches.
 */
exports.isSequelizeUniqueConstraintErrorForColumn = (err, column) => {
  return err instanceof UniqueConstraintError && err.errors.length === 1 && err.errors[0].path === column;
};

function serializeUniqueConstraintError(err) {
  // A sequelize UniqueConstraintError contains a list of ValidationErrorItem
  // objects which indicate the details of the constraint violation(s).
  return err.errors.map(item => {
    return {
      location: 'body',
      // WARNING: at the time of writing, this has not been tested with a
      // constraint violation on multiple columns. We will have to check what
      // happens when that occurs. `item.path` may contain multiple columns or
      // there may be multiple items for the same violation.
      message: item.message,
      path: `/${item.path}`,
      validation: 'unique'
    };
  });
}
