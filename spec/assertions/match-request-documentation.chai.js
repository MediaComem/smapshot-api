const { Assertion } = require('chai');
const jsonPointer = require('json-pointer');
const { get } = require('lodash');

const { convertOpenApiSchemaToJsonSchema } = require('../../utils/openapi-json-schema-interop');
const { coerceParameter } = require('../utils/api');
const { normalizeHttpHeaders } = require('../utils/http');
const { describeRequest, forbidNegate } = require('./utils');
const { findOpenApiOperation } = require('../utils/openapi');

/**
 * Chai method helper to check whether an HTTP request description object
 * matches a request documented in this API's OpenAPI document.
 *
 *     const req = {
 *       method: 'POST',
 *       path: '/foo',
 *       body: { foo: 'bar' }
 *     };
 *
 *     expect(req).to.matchRequestDocumentation();
 *
 * This assertion will perform the following checks:
 *
 * * The operation described by the request (the combination of its method and
 *   path) must be defined in the OpenAPI document.
 * * If the OpenAPI document requires a request body for this operation, the
 *   request object must have a body.
 * * If the request has a body, it must include a Content-Type header that
 *   matches one of the media types defined in the OpenAPI document for the
 *   operation. (If the media type is "application/json", it may be omitted.)
 * * If the request has a body, the OpenAPI document must include a JSON schema
 *   describing its format. By default, the request body must be valid according
 *   to the documented schema. However, if the `invalidBody` option is set to
 *   true, the request body must be invalid according to the schema.
 */
Assertion.addMethod('matchRequestDocumentation', function(options = {}) {

  // This assertion is too complex to support negation with `.not`.
  forbidNegate(this);

  const req = this._obj;
  const method = req.method;
  const query = req.query || {};
  const headers = normalizeHttpHeaders(req.headers || {});
  const path = req.path;
  const operationDescription = `operation ${method.toUpperCase()} ${path}`;

  // Find the OpenAPI operation matching the request.
  const { operation: openApiOperation, params: pathParams, pointer: openApiOperationPointer } = findOpenApiOperation(method, path);

  // Iterate over documented parameters (headers, URL query parameters, etc).
  const openApiParameters = get(openApiOperation, 'parameters', []);
  const invalidParameters = options.invalidParameters || [];
  openApiParameters.forEach((openApiParameter, i) => {

    let value;
    const { name, in: location, required } = openApiParameter;
    if (location === 'header') {
      value = headers[name.toLowerCase()];
    } else if (location === 'query') {
      value = query[name];
    } else if (location === 'path') {
      value = pathParams[name];
    } else {
      throw new Error(`Validation of OpenAPI parameter in ${JSON.stringify(location)} is not implemented`);
    }

    // If the parameter is documented as mandatory, make sure it is present in
    // the request.
    const parameterRequiredMsgFactory = to => [
      `expected request ${to} have ${location} parameter ${name} because the OpenAPI document requires it for ${operationDescription}`,
      describeRequest(req)
    ].join('\n\n');

    this.assert(
      !required || value !== undefined,
      parameterRequiredMsgFactory('to'),
      parameterRequiredMsgFactory('not to')
    );

    // The OpenAPI document MUST define a schema for all documented parameters.
    // This is not required by the OpenAPI specification but enforced for this
    // API.
    const schema = openApiParameter.schema;
    if (!schema) {
      throw new Error(`OpenAPI document does not define a schema for ${location} parameter ${name} for ${operationDescription} (path ${openApiOperationPointer}/parameters/${i})`);
    } else if (value === undefined) {
      // If the parameter is not required and is not present in the request,
      // the schema validation can be skipped.
      return;
    }

    const jsonSchema = convertOpenApiSchemaToJsonSchema(schema);

    // Coerce the value of the parameter to the expected type, in case it is a
    // string from a path or query parameter.
    const coercedValue = coerceParameter(value, schema);

    const matchOptions = {
      requestObject: req,
      what: `value of ${location} parameter ${name}`
    };

    // Validate the value of the parameter with the schema.
    if (invalidParameters !== true && !invalidParameters.includes(name)) {
      // By default, the value of a parameter MUST be valid according to its
      // documented schema.
      new Assertion(coercedValue).to.matchJsonSchema(jsonSchema, matchOptions);
    } else {
      // However, if the parameter is in the list of parameters that are
      // intentionally invalid, specified with the `invalidParameters` option
      // (or if that option is true), then it MUST be invalid according to that
      // same schema.
      new Assertion(coercedValue).not.to.matchJsonSchema(jsonSchema, matchOptions);
    }
  });

  const requestBodyPresent = Boolean(req.body);
  const requestBodyRequired = get(openApiOperation, [ 'requestBody', 'required' ], false);

  if (requestBodyRequired) {
    const bodyRequiredMsgFactory = to => [
      `expected request ${to} have a body because the OpenAPI document requires it for ${operationDescription}`,
      describeRequest(req)
    ].join('\n\n');

    this.assert(
      requestBodyPresent,
      bodyRequiredMsgFactory('to'),
      bodyRequiredMsgFactory('not to')
    );
  }

  // If the request has no body, there is no need to check anything else.
  if (!requestBodyPresent) {
    return;
  }

  // If the request has a body, the OpenAPI document MUST document its content.
  // This is not required by the OpenAPI specification but enforced for this
  // API.
  const openApiRequestBodyContentPointer = jsonPointer.compile([ 'requestBody', 'content' ]);
  if (!jsonPointer.has(openApiOperation, openApiRequestBodyContentPointer)) {
    throw new Error(`OpenAPI document does not define the content of the request body for ${operationDescription} (path ${openApiOperationPointer}${openApiRequestBodyContentPointer})`);
  }

  // The OpenAPI document MUST define exactly one media type for the content of
  // the request body. This is not required by the OpenAPI specification but
  // enforced for this API.
  const openApiRequestBodyContent = jsonPointer.get(openApiOperation, openApiRequestBodyContentPointer);
  const mediaTypes = Object.keys(openApiRequestBodyContent);
  if (!mediaTypes.length) {
    throw new Error(`OpenAPI document defines no media type for the content of the request body for ${operationDescription} (path ${openApiOperationPointer}${openApiRequestBodyContentPointer})`);
  } else if (mediaTypes.length >= 2) {
    throw new Error(`OpenAPI document defines more than one media type for the content of the request body for ${operationDescription} (path ${openApiOperationPointer}${openApiRequestBodyContentPointer})`);
  }

  // The request definition MUST have a content type that matches the documented
  // media type. If it does not specify a Content-Type header, it is assumed to
  // be "application/json".
  const mediaType = mediaTypes[0];
  const contentTypeHeader = headers['content-type'];
  const effectiveMediaType = contentTypeHeader ? contentTypeHeader.replace(/;.*$/, '') : 'application/json';

  const mediaTypeMismatchMsgFactory = to => [
    `expected request ${to} have content of media type ${mediaType} as documented by the OpenAPI document for ${operationDescription}`,
    describeRequest(req)
  ].join('\n\n');

  this.assert(
    effectiveMediaType === mediaType,
    mediaTypeMismatchMsgFactory('to'),
    mediaTypeMismatchMsgFactory('not to'),
    mediaType,
    effectiveMediaType
  );

  // The OpenAPI document MUST define a JSON schema for the content of the
  // request body. This is not required by the OpenAPI specification but
  // enforced for this API.
  const openApiSchemaPointer = jsonPointer.compile([ 'requestBody', 'content', mediaType, 'schema' ]);
  if (!jsonPointer.has(openApiOperation, openApiSchemaPointer)) {
    throw new Error(`OpenAPI document must define a JSON schema for the content of the request body for ${operationDescription} (path ${openApiOperationPointer}${openApiSchemaPointer})`)
  }

  // Validate the request body.
  const invalidBody = get(options, 'invalidBody', false);
  const openApiSchema = jsonPointer.get(openApiOperation, openApiSchemaPointer);
  const jsonSchema = convertOpenApiSchemaToJsonSchema(openApiSchema);
  if (!invalidBody) {
    // If the `invalidBody` option is not specified (the default) or falsy, the
    // request body MUST be valid according to the documented JSON schema.
    new Assertion(req).to.matchJsonSchema(jsonSchema);
  } else {
    // If the `invalidBody` option is truthy, then the request body MUST be
    // invalid according to that same schema.
    new Assertion(req).not.to.matchJsonSchema(jsonSchema);
  }
});
