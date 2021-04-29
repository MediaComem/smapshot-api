const { Assertion } = require('chai');
const { isFinite, isString } = require('lodash');

const { getJsonSchema } = require('../../app/utils/schemas');
const { compileJsonSchema, getCompiledJsonSchema } = require('../utils/openapi');
const { describeData, describeRequest, describeResponse } = require('./utils');

/**
 * Chai method helper to check whether an object matches a JSON schema:
 *
 *     const someSchema = {
 *       type: 'object',
 *       properties: {
 *         name: {
 *           type: 'string',
 *           minLength: 2
 *         }
 *       }
 *     };
 *
 *     expect(data).to.matchJsonSchema(someSchema);
 *
 * If the object is an HTTP request definition or HTTP response, the schema will
 * be used to validate its body:
 *
 *     expect(req).to.matchJsonSchema(someSchema);
 *     expect(res).to.matchJsonSchema(someSchema);
 *
 * You can also use one of the named schemas defined in the
 * `/components/schemas` property of this API's OpenAPI document:
 *
 *     expect(data).to.matchJsonSchema('TheNameOfSomeCustomSchema');
 */
Assertion.addMethod('matchJsonSchema', function(schemaOrName, options = {}) {
  const schema = isString(schemaOrName) ? getJsonSchema(schemaOrName) : schemaOrName;
  const compiledSchema = isString(schemaOrName) ? getCompiledJsonSchema(schemaOrName) : compileJsonSchema(schemaOrName);

  const object = this._obj;

  let actual;
  let what;
  let description;
  let match;
  if (isHttpRequest(object)) {
    // If the object looks like an HTTP request definition, validate its body.
    actual = object.body;
    what = options.what || 'HTTP request';
    description = describeRequest(object);
    match = 'have a body that matches'
  } else if (isHttpResponse(object)) {
    // If the object looks like an HTTP response, validate its body.
    actual = object.body;
    what = options.what || 'HTTP response';
    description = describeResponse(object);
    match = 'have a body that matches';
  } else {
    // Otherwise, validate the object itself.
    actual = object;
    what = options.what || 'data';
    description = describeData(object);
    match = 'match';
  }

  const valid = compiledSchema(actual);
  const errors = compiledSchema.errors ? compiledSchema.errors.slice() : [];

  const msgFactory = to => {

    const parts = [
      `expected ${what}`,
      description,
      `${to} ${match} JSON schema`,
      describeData(schema)
    ];

    if (errors.length) {
      parts.push(
        'but the following validation errors occurred',
        describeData(errors)
      );
    }

    if (options.requestObject) {
      parts.push(
        'The request object was',
        describeData(options.requestObject)
      );
    }

    return parts.join('\n\n');
  };

  this.assert(
    valid,
    msgFactory('to'),
    msgFactory('not to')
  );
});

function isHttpRequest(object) {
  return object !== null && typeof object === 'object' && (object.method === undefined || isString(object.method)) && isString(object.path) && object.body;
}

function isHttpResponse(object) {
  return object !== null && typeof object === 'object' && isFinite(object.status) && object.body;
}
