const { compact, difference, isArray, isFinite, isInteger, isPlainObject, isString, mapValues } = require('lodash');
const request = require('supertest');

const { dereferencedOpenApiDocument } = require('../../app/utils/openapi');
const { normalizeHttpHeaders } = require('./http');
const { findOpenApiOperation } = require('./openapi');

const allowedMethods = [ 'DELETE', 'GET', 'PATCH', 'POST', 'PUT' ];

// Keep track of what API elements have been tested.
const tested = {
  headers: [],
  queryParams: [],
  requests: []
};

/**
 * Coerces the value of a parameter (e.g. a path or query parameter from an HTTP
 * request, which is always retrieved as a string) to a given JSON schema. If
 * the value cannot be coerced to the equivalent type, it is returned unchanged.
 *
 *     coerceParameter('2', { type: 'integer' });    // 2
 *     coerceParameter('foo', { type: 'integer' });  // 'foo'
 *     coerceParameter('foo', { type: 'string' });   // 'foo'
 *     coerceParameter(2, { type: 'string' });       // '2'
 *
 *     // Simple array types are supported as well:
 *     coerceParameter([ '2', '3' ], { type: 'array', items: { type: 'integer' }});  // [ 2, 3 ]
 *
 *     // No coercion is performed with an undefined schema:
 *     coerceParameter(2, undefined);      // 2
 *     coerceParameter('2', undefined);    // '2'
 *
 * @param {string} value - The string value to coerce.
 * @param {object} schema - The JSON schema type to coerce to. If undefined, the
 * original value is returned unchanged.
 * @returns {*} The coerced value if it could be coerced; the original value
 * otherwise.
 * @throws If the JSON schema type is not supported.
 */
exports.coerceParameter = (value, schema) => {
  const originalValue = value;
  const originalSchema = schema;
  return coerceParameter(value, schema, originalValue, originalSchema);
};

function coerceParameter(value, schema, originalValue, originalSchema) {
  const toType = schema.type;
  if (toType === undefined) {
    return value;
  } else if (toType === 'boolean') {
    return value === 'true' || value === 'false' ? Boolean(value) : value;
  } else if (toType === 'integer') {
    const coercedValue = parseInt(value, 10);
    return isInteger(coercedValue) ? coercedValue : value;
  } else if (toType === 'number') {
    const coercedValue = parseFloat(value);
    return isFinite(coercedValue) ? coercedValue : value;
  } else if (toType === 'string') {
    return String(value);
  } else if (toType === 'array') {
    // Recursively coerce array items.
    const itemsSchema = schema.items;
    return isArray(value) ? value.map(item => exports.coerceParameter(item, itemsSchema, originalValue, originalSchema)) : value;
  } else {
    throw new Error(`Unsupported coercion of value ${JSON.stringify(originalValue)} to JSON schema ${JSON.stringify(originalSchema)}`);
  }
}

/**
 * Freezes and returns the specified value. Useful to make sure a structure is
 * not modified during tests, such as a request object.
 *
 *     const frozenObject = freeze({ foo: 'bar' });
 *     const frozenArray = freeze([ 'foo', 'bar' ]);
 *
 * @param {(Array|Object)} value - The value to freeze.
 * @returns The frozen value.
 */
exports.freeze = value => {
  if (isArray(value)) {
    return Object.freeze(value.map(exports.freeze));
  } else if (isPlainObject(value)) {
    return Object.freeze(mapValues(value, exports.freeze));
  } else {
    return value;
  }
};

/**
 * Analyzes which parts of the API have been documented but not tested, and
 * conversely, which parts have been tested but are not documented.
 *
 * This analysis is based on the API's OpenAPI documentation, and relies on the
 * assumption that all tests are performed using the `testHttpRequest` function
 * which registers all requests made and responses received.
 */
exports.getApiCoverage = () => {

  // TODO: check responses
  const documented = getDocumentedApiElements();

  const undocumented = {
    headers: difference(tested.headers, documented.headers),
    queryParams: difference(tested.queryParams, documented.queryParams),
    requests: difference(tested.requests, documented.requests)
  };

  const untested = {
    headers: difference(documented.headers, tested.headers),
    queryParams: difference(documented.queryParams, tested.queryParams),
    requests: difference(documented.requests, tested.requests)
  };

  return { undocumented, untested };
};

/**
 * Makes an HTTP request on an Express application under test.
 *
 * This is a convenience to use the `supertest` library with an object that
 * represents the HTTP request to make, instead of chained calls. The following
 * calls are equivalent:
 *
 *     testHttpRequest(app, {
 *       method: 'POST',
 *       path: '/foo',
 *       body: { bar: 'baz' }
 *     });
 *
 *     supertest(app)
 *       .post('/foo')
 *       .send({ bar: 'baz' });
 *
 * @param {express.Express} app - The Express application to test.
 * @param {HttpRequestDefinition} req - The HTTP request to make.
 * @returns {Promise<HttpResponse>} A promise that will be resolved with the
 * HTTP response (no assertion is made on the status code or content of the
 * response, e.g. the promise will still be resolved if the response is HTTP 400
 * Bad Request).
 */
exports.testHttpRequest = (app, req) => {
  if (req.method !== undefined && !isString(req.method)) {
    throw new Error(`HTTP test request object must have a "method" property which is a string, but its type is ${typeof req.method}`);
  } else if (req.method !== undefined && !allowedMethods.includes(req.method.toUpperCase())) {
    throw new Error(`Unsupported HTTP test method ${JSON.stringify(req.method)}; supported methods are: ${allowedMethods.join(', ')}`);
  }

  const method = req.method || 'GET';

  const path = req.path;
  if (!isString(path)) {
    throw new Error(`HTTP test request object must have "path" property which is a string, but its type is ${typeof path}`);
  }

  const testedRequest = getRequestIdentifier(req);
  registerTested(tested.requests, testedRequest);

  let chain = request(app)[method.toLowerCase()](path);

  if (req.query) {
    chain = chain.query(req.query);
    Object.keys(req.query).forEach(queryParam => registerTested(tested.queryParams, `${testedRequest} ?${queryParam}`));
  }

  if (req.headers) {
    chain = chain.set(req.headers);
    Object.keys(req.headers).forEach(name => registerTested(tested.headers, `${testedRequest} ${name.toLowerCase()}`))
  }

  if (req.body) {
    chain = chain.send(req.body);
  }

  return chain;
};

function getDocumentedApiElements() {

  const documented = {
    headers: [],
    queryParams: [],
    requests: []
  };

  const { paths } = dereferencedOpenApiDocument;

  // Look at every path of the OpenAPI document.
  for (const [ path, methods ] of Object.entries(paths)) {
    // Look at every HTTP method under that path.
    for (const [ method, operation ] of Object.entries(methods)) {
      const request = `${method.toUpperCase()} ${path}`;

      // Add documented query parameters.
      if (operation.parameters) {
        for (const parameter of operation.parameters) {
          if (parameter.in === 'query') {
            documented.queryParams.push(`${request} ?${parameter.name}`);
          }
        }
      }

      if (operation.requestBody && operation.requestBody.content) {
        // Add one request for each documented content type for requests
        // that have a body (e.g. PATCH, POST, PUT).
        const contentTypes = Object.keys(operation.requestBody.content);
        documented.requests.push(...contentTypes.map(contentType => `${request} ${contentType}`));
      } else {
        // Otherwise simply add the request (e.g. DELETE, GET).
        documented.requests.push(request);
      }
    }
  }

  return documented;
}

function getRequestIdentifier(req) {
  const method = req.method || 'GET';

  // Get the documented path of the OpenAPI operation which was requested, or
  // default to the request path if no matching path can be found in the
  // documentation.
  const openApiOperation = findOpenApiOperation(method, req.path, false);
  const path = openApiOperation ? openApiOperation.path : req.path;

  // Get the request's media type from the value of the Content-Type header
  // (without the charset) or default to application/json if the request has a
  // body.
  const normalizedHeaders = req.headers ? normalizeHttpHeaders(req.headers) : undefined;
  const contentType = normalizedHeaders ? normalizedHeaders['content-type'] : undefined;
  const mediaType = contentType ? contentType.replace(/;.*$/, '') : (req.body ? 'application/json' : undefined);

  // The ID is in the format "GET /path" or "POST /path media/type". If the URL
  // path has parameters, the ID contains the documented path, not the actual,
  // request path, i.e. "/users/{userId}" instead of "/users/2".
  return compact([ method.toUpperCase(), path, mediaType ]).join(' ');
}

function registerTested(registered, test) {
  if (!registered.includes(test)) {
    registered.push(test);
  }
}

/**
 * @typedef {Object} HttpRequestDefinition
 * @property {("DELETE"|"GET"|"PATCH"|"POST"|"PUT")} method - The HTTP method of
 * the request.
 * @property {string} path - The path of the request.
 * @property {Map.<string, (string | string[])>} [query] - Optional URL query
 * parameters.
 * @property {Map.<string, string>} [headers] - Optional request headers. The
 * Content-Type header will default to "application/json" when a body is sent.
 * See https://visionmedia.github.io/superagent/#setting-header-fields.
 * @property {*} [body] - The optional body of the request. See
 * https://visionmedia.github.io/superagent/#serializing-request-body.
 */
