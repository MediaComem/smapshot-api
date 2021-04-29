const Ajv = require('ajv');
const jsonPointer = require('json-pointer');
const { isEqual } = require('lodash');

const { dereferencedOpenApiDocument } = require('../../app/utils/openapi');
const { schemas } = require('../../app/utils/schemas');
const config = require('../../config');

// Create an Ajv instance with all of this API's JSON schemas included so that
// one schema may reference another.
const allSchemas = Object.values(schemas);
const ajv = new Ajv(config.ajv).addSchema(allSchemas);

/**
 * Compiles a JSON schema object into a function that can be used to validate
 * data.
 *
 *     const schema = { type: 'string' };
 *     const compiled = compileJsonSchema(schema);
 *     console.log(compiled('foo'));  // true
 *     console.log(compiled(42));     // false
 *
 * @param {Object} schema - An object representing a JSON schema.
 * @returns {Function} The compiled schema.
 */
exports.compileJsonSchema = schema => {

  if (schema.$id) {
    // If schema has an $id, check if the schema is one of the already-compiled schemas of this API's OpenAPI
    // document, simply return the existing function.
    const existingSchema = ajv.getSchema(schema.$id);
    if (existingSchema && existingSchema.schema === schema || isEqual(existingSchema.schema, schema)) {
      return existingSchema;
    }
  }
  // Otherwise compile it from scratch.
  return ajv.compile(schema);
};

/**
 * Finds and returns the specified operation in this application's OpenAPI
 * document. An error is thrown if no documented operation can be found matching
 * the specified request path (unless `required` is set to false).
 *
 *     const result = findOpenApiOperation('GET', '/users/2');
 *     console.log(result.path); // "/users/{userId}"
 *     console.log(result.params); // { userId: "2" }
 *     console.log(result.pointer); // "/paths/~1users~1{userId}/get"
 *     console.log(result.operation); // OpenAPI operation object
 *
 *     findOpenApiOperation('GET', '/foo'); // Error: OpenAPI document does not define operation GET /foo
 *     findOpenApiOperation('GET', '/foo', false); // undefined
 *
 * @param {string} method - The HTTP method (GET, POST, etc).
 * @param {string} path - The URL path of a request (e.g. "/users/2").
 * @param {boolean} required - Whether the operation is required to be
 * documented (true by default).
 * @returns {OpenApiOperationResult} The corresponding OpenAPI operation along
 * with its documented path or path template.
 * @throws If `required` is true (the default) and the operation is not found.
 */
exports.findOpenApiOperation = (method, path, required = true) => {

  const matchingPath = findMatchingOpenApiPath(path);
  if (!matchingPath) {
    throw new Error(`OpenAPI document does not define operation ${method.toUpperCase()} ${path}`);
  }

  const { path: documentedPath, params } = matchingPath;
  const pointer = jsonPointer.compile([ 'paths', documentedPath, method.toLowerCase() ]);
  if (!jsonPointer.has(dereferencedOpenApiDocument, pointer)) {
    if (required) {
      throw new Error(`OpenAPI document does not define operation ${method.toUpperCase()} ${documentedPath}`);
    }

    return;
  }

  return {
    params,
    pointer,
    operation: jsonPointer.get(dereferencedOpenApiDocument, pointer),
    path: documentedPath
  };
};

/**
 * Returns one of the JSON schemas defined in this API's OpenAPI document,
 * compiled with the `ajv` validation library.
 *
 *     const data = { foo: 'bar' };
 *     const schema = getCompiledJsonSchema('SomeCustomSchema');
 *     const valid = schema(data);
 *
 * @param {string} name - The name of a JSON schema in the
 * `/components/schemas` property of this API's OpenAPI document.
 * @returns {Function} A compiled JSON schema that can be used to validate data.
 */
exports.getCompiledJsonSchema = name => {

  const schema = ajv.getSchema(name);
  if (!schema) {
    throw new Error(`OpenAPI document defines no JSON schema named ${JSON.stringify(name)} at /components/schemas`);
  }

  return schema;
};

/**
 * Finds and returns the documented path that matches the specified URL path in
 * this API's OpenAPI document.
 *
 *     findMatchingOpenApiPath("/users");    // { path: "/users", params: {} }
 *     findMatchingOpenApiPath("/users/2");  // { path: "/users/{userId}", params: { userId: '2' } }
 *
 * @param {string} path - The URL path of a request (e.g. "/users/2").
 * @returns {OpenApiPathResult|undefined} - The documented path and the value of
 * its parameters if it has any, or undefined if no matching path was found in
 * the documentation.
 */
function findMatchingOpenApiPath(path) {

  const pathParts = path.split('/');
  const documentedPaths = Object.keys(dereferencedOpenApiDocument.paths);
  for (const documentedPath of documentedPaths) {
    const matchResult = matchPathToDocumentedPath(pathParts, documentedPath);
    if (matchResult) {
      return matchResult;
    }
  }

  // Return nothing if no matching path is found.
}

/**
 * Checks if the segments of a request path match the documented path of an
 * OpenAPI operation.
 *
 *     // Invalid matches:
 *     matchPathToDocumentedPath([ 'foo' ], '/bar');                    // undefined
 *     matchPathToDocumentedPath([ 'foo' ], '/foo/bar');                // undefined
 *     matchPathToDocumentedPath([ 'foo', 'bar' ], '/foo');             // undefined
 *
 *     // Valid matches:
 *     matchPathToDocumentedPath([ 'foo' ], '/foo');                    // { path: '/foo', params: {} }
 *     matchPathToDocumentedPath([ 'foo', 'bar' ], '/foo/bar');         // { path: '/foo/bar', params: {} }
 *     matchPathToDocumentedPath([ 'users', '2' ], '/users/{userId}');  // { path: '/users/{userId}', params: { userId: '2' } }
 *
 * @param {string[]} pathParts - The path segments to check.
 * @param {string} documentedPath - The documented path to check the segments
 * against.
 * @returns {OpenApiPathResult|undefined} - The documented path and the value of
 * its parameters if it has any, or undefined if no matching path was found in
 * the documentation.
 */
function matchPathToDocumentedPath(pathParts, documentedPath) {

  // If the actual path and documented path have a different length, they
  // cannot be the same path.
  const pathLength = pathParts.length;
  const documentedPathParts = documentedPath.split('/');
  if (pathLength !== documentedPathParts.length) {
    return;
  }

  // If they have the same length, check each path segment.
  const pathParams = {};
  for (let i = 0; i < pathLength; i++) {

    const pathPart = pathParts[i];
    const documentedPathPart = documentedPathParts[i];
    if (pathPart === documentedPathPart) {
      // If the current path segments match, check the the next segment.
      continue;
    }

    const match = documentedPathPart.match(/^\{([^{}]+)\}$/);
    if (!match) {
      // If the current segment of the documented path is not a dynamic path
      // parameter (e.g. "{id}"), then the paths do not match.
      return;
    }

    // Store the value of each matched parameter.
    pathParams[match[1]] = pathPart;
  }

  // Return the documented path and all matched parameters.
  return { path: documentedPath, params: pathParams };
}

/**
 * @typedef {Object} OpenApiOperationResult
 * @property {Object} operation - The OpenAPI operation object.
 * @property {Object} params - The URL path parameters, if any.
 * @property {string} path - The documented path or path template of the
 * operation.
 * @property {string} pointer - A JSON pointer to the operation in the OpenAPI
 * document.
 */

/**
 * @typedef {Object} OpenApiPathResult
 * @property {string} path - The documented path of an OpenAPI operation which
 * matches a request.
 * @property {Object.<string,string>} - The parameters of the path that were
 * extracted from the actual request path. This may be an empty object if the
 * path has no parameters.
 */
