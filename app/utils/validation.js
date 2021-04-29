const Ajv = require('ajv');
const ajvErrors = require('ajv-errors');
const { compact, get, isArray, uniq } = require('lodash');
const { ForeignKeyConstraintError } = require('sequelize');

const config = require('../../config');
const { schemas } = require('./schemas');
const { foreignKeyConstraintError, requestParametersValidationError, requestBodyValidationError } = require('./errors');
const { openApiDocument } = require('./openapi');

const supportedOpenApiParameterLocations = [ 'header', 'query', 'path' ];

// Create an Ajv instance with all of this API's JSON schemas included so that
// one schema may reference another.
const allSchemas = Object.values(schemas);
const ajv = ajvErrors(new Ajv(config.ajv)).addSchema(allSchemas);
const parametersAjv = ajvErrors(new Ajv({ ...config.ajv, coerceTypes: true })).addSchema(allSchemas);

/**
 * Re-throws known foreign key constraint errors as human-readable validation
 * errors. If the error is unknown, it is ignored.
 *
 * @param {express.Request} req - The Express request object.
 * @param {sequelize.ForeignKeyConstraintError} err - The error to re-throw.
 * @param {Object[]} constraints - Known foreign key constraint errors.
 * @param {string} constraints[].index - The name of the constraint's index in
 * the database.
 * @param {string} constraints[].property - The name of the request body
 * property containing the ID inserted into the foreign key column for use in
 * the error message.
 * @param {string} constraints[].description - A human-readable description of
 * the entity referenced by the foreign key (e.g. "image", "user") for use in
 * the error message.
 */
exports.handleForeignKeyConstraintErrors = (req, err, constraints) => {
  if (err instanceof ForeignKeyConstraintError) {
    for (const { index, property, description } of constraints) {
      if (err.index === index) {
        throw foreignKeyConstraintError(req, err, property, description);
      }
    }
  }
};

/**
 * Returns an Express middleware function which will validate the body of the
 * request with a JSON schema.
 *
 * @param {string} name - The name of the JSON schema in the
 * `/components/schemas` property of this API's OpenAPI document.
 * @returns {Function} An Express middleware function.
 */
exports.validateRequestBodyWithJsonSchema = name => {

  const schema = ajv.getSchema(name);
  if (!schema) {
    throw new Error(`No JSON schema named ${JSON.stringify(name)} found`);
  }

  return (req, res, next) => {

    const valid = schema(req.body);
    if (!valid) {
      const serializedErrors = schema.errors.map(err => serializeAjvError(err, 'body'));
      return next(requestBodyValidationError(req, serializedErrors));
    }

    next();
  };
};

/**
 * Returns an Express middleware function which will validate the parameters of
 * the request based on the OpenAPI documentation for the specified operation.
 *
 *     router.get("/some/path",
 *       validateDocumentedRequestParametersFor("GET", "/some/path"),
 *       controller.someOperation
 *     );
 *
 * @param {string} method - The HTTP method (GET, POST, etc) of the operation.
 * @param {string} path - The URL path of the operation.
 * @returns {Function} An Express middleware function.
 */
exports.validateDocumentedRequestParametersFor = (method, path) => {

  const openApiOperation = get(openApiDocument, [ 'paths', path, method.toLowerCase() ]);
  const operationDescription = `operation ${method.toUpperCase()} ${path}`;
  if (!openApiOperation) {
    throw new Error(`OpenAPI document does not define ${operationDescription}`);
  }

  const parameters = openApiOperation.parameters;
  if (!isArray(parameters)) {
    throw new Error(`OpenAPI document defines no parameters for ${operationDescription}`)
  }

  const bodyParameters = parameters.filter(param => param.in === 'body');
  if (bodyParameters.length) {
    throw new Error(`Validation of OpenAPI "body" parameters for ${operationDescription} is not supported; define a JSON schema for the request body instead`);
  }

  const validators = compact([
    // Validate documented HTTP headers.
    createParametersValidator(openApiOperation, 'header', req => req.headers),
    // Validate documented URL query parameters.
    createParametersValidator(openApiOperation, 'query', req => req.query),
    // Validate documented URL path parameters.
    createParametersValidator(openApiOperation, 'path', req => req.params)
  ]);

  // If no parameter is documented, this function should not have been called.
  if (!validators.length) {
    throw new Error(`No header or query parameter found to validate for ${operationDescription}`);
  }

  // Return a middleware that will run all parameter validations and return all
  // errors together if any are found.
  return (req, res, next) => {

    const errors = validators.reduce(
      (memo, validator) => [ ...memo, ...validator(req) ],
      []
    );

    if (errors.length) {
      return next(requestParametersValidationError(req, errors));
    }

    next();
  };
};

/**
 * Transforms an array of [OpenAPI parameter
 * objects](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#parameterObject)
 * into a JSON schema.
 *
 * This function can be used to generate a JSON schema that will validate HTTP
 * request parameters of a given type, e.g. URL query parameters, based on this
 * project's OpenAPI documentation.
 *
 *     const schema = createJsonSchemaFromOpenApiParameters([
 *       { name: "name", in: "query", schema: { type: "string", minLength: 2 } },
 *       { name: "published", in: "query", required: true, schema: { type: "boolean" } }
 *     ]);
 *
 *     console.log(schema);
 *     // {
 *     //   $schema: 'http://json-schema.org/draft-07/schema',
 *     //   type: "object",
 *     //   properties: {
 *     //     name: {
 *     //       type: "string",
 *     //       minLength: 2
 *     //     },
 *     //     published: {
 *     //       type: "boolean"
 *     //     }
 *     //   },
 *     //   additionalProperties: false,
 *     //   required: [ "published" ]
 *     // }
 *
 * @param {Object[]} parameters - An array of OpenAPI parameters.
 * @returns {Object} A JSON schema that will validate an object containing the
 * specified parameters.
 */
function createJsonSchemaFromOpenApiParameters(parameters) {
  return {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object',
    properties: parameters.reduce(
      (memo, parameter) => ({
        ...memo,
        [parameter.name]: parameter.schema
      }),
      {}
    ),
    additionalProperties: false,
    required: parameters.filter(param => param.required).map(param => param.name)
  };
}

/**
 * Retrieves the OpenAPI parameters of a given type documented for the specified
 * operation, and returns an Express middleware that will validate those
 * parameters in the request.
 *
 *     createParametersValidator(openApiOperation, "query", req => req.query);
 *
 * @param {Object} openApiOperation - The operation object from the parsed
 * OpenAPI documentation.
 * @param {("header"|"path"|"query")} location - The type of parameter to
 * validate. Matching parameters from the specified operation will be turned
 * into a JSON schema for validation.
 * @param {Function} sourceFunc - A function that extracts the data to validate
 * from the request. The returned value should be an object which will be
 * validated with a JSON schema based on the documented parameters.
 * @returns {Function} An Express middleware function.
 */
function createParametersValidator(openApiOperation, location, sourceFunc) {
  if (!supportedOpenApiParameterLocations.includes(location)) {
    throw new Error(`OpenAPI parameter location ${JSON.stringify(location)} is not supported; allowed locations are: ${supportedOpenApiParameterLocations.join(', ')}`);
  }

  const parameters = openApiOperation.parameters.filter(param => param.in === location);
  if (!parameters.length) {
    return;
  }

  const parametersSchema = parametersAjv.compile(createJsonSchemaFromOpenApiParameters(parameters));
  return req => {
    const parametersToValidate = sourceFunc(req);
    const valid = parametersSchema(parametersToValidate);
    return valid ? [] : parametersSchema.errors.map(err => serializeAjvError(err, location));
  };
}

/**
 * Serializes an error from the `ajv` library into an object following our
 * standard error format.
 *
 * @param {Object} err - The `ajv` error to serialize.
 * @param {("header"|"path"|"query")} location - Where this error occurred in
 * the request.
 * @returns {Object} A serialized error object that can be sent to the API
 * client as part of a response.
 */
function serializeAjvError(err, location) {

  // By default, the "validation" property of the serialized error is the
  // JSON schema keyword (e.g. "type", "minLength") that caused the error.
  let validation = err.keyword;
  if (validation === 'errorMessage') {
    // If a JSON schema validation is complex (e.g. "oneOf" for a property that
    // can be a scalar or an array), the default error message is not
    // user-friendly.
    //
    // It can be overriden with the "errorMessage" property from the
    // https://github.com/ajv-validator/ajv-errors library. Then the keyword
    // will be "errorMessage", and the error will have a list of child errors
    // which are the original errors that were overridden.
    //
    // In that case, we send the list of unique keywords of these child errors
    // to the client in the "validation" property of the serialized error.
    validation = uniq(err.params.errors.map(childError => childError.keyword)).sort();
  }

  return {
    location,
    validation,
    message: err.message,
    path: err.dataPath
  };
}
