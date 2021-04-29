const { Assertion } = require('chai');
const jsonPointer = require('json-pointer');
const { isEqual } = require('lodash');

const { dereferencedOpenApiDocument } = require('../../app/utils/openapi');
const { convertOpenApiSchemaToJsonSchema } = require('../../utils/openapi-json-schema-interop');
const { describeResponse, forbidNegate } = require('./utils');
const { findOpenApiOperation } = require('../utils/openapi');

/**
 * Chai method helper to check whether an HTTP response matches a response
 * documented in this API's OpenAPI document.
 *
 *     const res = await supertest(app)
 *       .post('/foo')
 *       .send({ bar: 'baz' });
 *
 *     expect(res).to.matchResponseDocumentation();
 *
 * This assertion will perform the following checks:
 *
 * * The operation corresponding to the request that was made (the combination
 *   of its method and path) must be defined in the OpenAPI document.
 * * The OpenAPI document must define a response for this operation with the
 *   same status code as the response that was received.
 * * If the response has a body, it must include a Content-Type header that
 *   matches one of the media types defined in the OpenAPI document for the
 *   response.
 * * If the response has a body, the OpenAPI document must include a JSON schema
 *   describing its format. The response body must be valid according to the
 *   schema.
 *
 * An options object can be passed which may contain the following settings:
 *
 * * `noContent` (boolean) - If true, the OpenAPI document is expected to
 *   define no response for the tested operation, and the response is expected
 *   to have no body and no Content-Type header. This is always the case for 204
 *   No Content responses, regardless of this option. This option may be set to
 *   true to test responses that have no content but do not use the correct HTTP
 *   status code.
 */
Assertion.addMethod('matchResponseDocumentation', function(options = {}) {

  // This assertion is too complex to support negation with `.not`.
  forbidNegate(this);

  const res = this._obj;
  const req = res.req;
  if (!req) {
    throw new Error('HTTP response object must have a "req" property containing the HTTP request that was made');
  }

  const method = req.method;
  // Remove any query parameters or hash fragment from the request path.
  const path = req.path.replace(/[?#].*$/, '');
  const statusCode = res.status;
  const openApiDocument = dereferencedOpenApiDocument;
  const operationDescription = `operation ${method.toUpperCase()} ${path}`;
  const responseDescription = `the ${statusCode} response for ${operationDescription}`;

  // Find the OpenAPI operation for the request.
  const { pointer: openApiOperationPointer } = findOpenApiOperation(method, path);

  // The OpenAPI document MUST have an entry for that request (method & path)
  // and response (status code), unless the status code is 500 Internal Server
  // Error (which is not explicitly documented).
  const openApiResponsePointer = jsonPointer.compile([ ...jsonPointer.parse(openApiOperationPointer), 'responses', String(statusCode) ]);
  if (!jsonPointer.has(openApiDocument, openApiResponsePointer)) {
    if (statusCode === 500) {

      // Check that 500 Internal Server Error responses are in the correct
      // format.
      new Assertion(res)
        .to.have.header('Content-Type', 'application/problem+json; charset=utf-8')
        .and.to.matchJsonSchema('GenericHttpProblemDetails');

      return;
    }

    throw new Error(`OpenAPI document does not define ${responseDescription} (path ${openApiResponsePointer})`);
  }

  // The OpenAPI document MUST define the content of the response. This is not
  // required by the OpenAPI documentation but enforced for this API.
  const openApiResponse = jsonPointer.get(openApiDocument, openApiResponsePointer);
  const openApiResponseContent = openApiResponse.content;

  const responseShouldHaveNoContent = statusCode === 204 || options.noContent;

  // If the status code of the response is 204 No Content or the "noContent"
  // option is passed to this assertion, the OpenAPI document MUST NOT define a
  // content for the response and the response must have no body or Content-Type
  // header.
  if (responseShouldHaveNoContent) {
    if (openApiResponseContent) {
      throw new Error(`OpenAPI document defines the content of ${responseDescription} (path ${openApiResponsePointer}/content) but the status code is 204 No Content or the "noContent" option was passed`);
    }

    const noContentMismatchMsgFactory = to => [
      `expected response ${to} have no body and no Content-Type header as documented by the OpenAPI document for ${responseDescription}`,
      describeResponse(res)
    ];

    this.assert(
      isEqual(res.body, {}) && !res.headers['content-type'],
      noContentMismatchMsgFactory('to'),
      noContentMismatchMsgFactory('not to'),
      {},
      res.body
    );

    // If the response has no content as documented, then it is valid. No need
    // to continue to check the response body.
    return;
  } else if (!openApiResponseContent) {
    throw new Error(`OpenAPI document does not define the content of ${responseDescription} (path ${openApiResponsePointer}/content)`);
  }

  // The OpenAPI document MUST define exactly one media type for the content of
  // the response. This is not required by the OpenAPI specification but
  // enforced for this API.
  const mediaTypes = Object.keys(openApiResponseContent);
  if (!mediaTypes.length) {
    throw new Error(`OpenAPI document defines no media type for the content of ${responseDescription} (path ${openApiResponsePointer}/content)`);
  } else if (mediaTypes.length >= 2) {
    throw new Error(`OpenAPI document defines more than one media type for the content of ${responseDescription} (path ${openApiResponsePointer}/content)`);
  }

  // The response MUST have a content type that matches the documented media
  // type.
  const mediaType = mediaTypes[0];
  const contentTypeHeader = res.headers['content-type'];
  const effectiveMediaType = contentTypeHeader.replace(/;\s*charset.*$/, '');

  const contentTypeMismatchMsgFactory = to => [
    `expected response ${to} have content of media type ${mediaType} as documented by the OpenAPI document for ${responseDescription}`,
    describeResponse(res)
  ].join('\n\n');

  this.assert(
    effectiveMediaType === mediaType,
    contentTypeMismatchMsgFactory('to'),
    contentTypeMismatchMsgFactory('not to'),
    mediaType,
    effectiveMediaType
  );

  // The OpenAPI document MUST define a JSON schema for that response. This is
  // not required by the OpenAPI specification but enforced for this API.
  const openApiSchemaPointer = jsonPointer.compile([ 'content', mediaType, 'schema' ]);
  if (!jsonPointer.has(openApiResponse, openApiSchemaPointer)) {
    throw new Error(`OpenAPI document does not define a JSON schema for ${responseDescription} (path ${openApiResponsePointer}${openApiSchemaPointer})`);
  }

  // The response body MUST match the documented JSON schema.
  const openApiSchema = jsonPointer.get(openApiResponse, openApiSchemaPointer);
  const jsonSchema = convertOpenApiSchemaToJsonSchema(openApiSchema);
  new Assertion(res).to.matchJsonSchema(jsonSchema);
});
