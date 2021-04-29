const jsonPointer = require('json-pointer');
const { isArray, isPlainObject } = require('lodash');

const { expect } = require('../../spec/utils/chai');
const { dereferencedOpenApiDocument } = require('../utils/openapi');

// Run a few checks on the OpenAPI document itself.
describe('OpenAPI document', () => {
  it('defines schemas for all parameters and all examples are valid', () => {
    // Check each OpenAPI operation (under `/paths/<url>/<method>` in the
    // OpenAPI document).
    eachOpenApiOperation((openApiOperation, operationPath, operationDescription) => {

      // Skip this operation if it has no parameters.
      const openApiParameters = openApiOperation.parameters;
      if (!openApiParameters) {
        return;
      }

      // Check each parameter.
      openApiParameters.forEach(({ example, examples, in: location, name, schema }, i) => {
        const parameterPath = [ ...operationPath, 'parameters', i ];

        // Ensure the parameter has a schema.
        if (!schema) {
          throw new Error(`OpenAPI document defines no schema for ${location} parameter ${name} for operation ${operationDescription} (path ${jsonPointer.compile(parameterPath)})`);
        }

        // Check the single example if present.
        if (example !== undefined) {
          expect(
            example,
            `OpenAPI document parameter example at ${jsonPointer.compile([ ...parameterPath, 'example' ])} does not match its schema`
          ).to.matchJsonSchema(schema);
        }

        // Check the list of examples if present.
        if (examples !== undefined) {
          examples.forEach((currentExample, currentExampleIndex) => {
            expect(
              currentExample,
              `OpenAPI document parameter example at ${jsonPointer.compile([ ...parameterPath, 'examples', currentExampleIndex ])} does not match its schema`
            ).to.matchJsonSchema(schema);
          });
        }
      });
    });
  });

  it('defines enumerations with a type in schemas', () => {
    // Check each OpenAPI operation (under `/paths/<url>/<method>` in the
    // OpenAPI document).
    eachOpenApiOperation((openApiOperation, operationPath, operationDescription) => {

      // Skip this operation if it has no parameters.
      const openApiParameters = openApiOperation.parameters;
      if (!openApiParameters) {
        return;
      }

      // Check each parameter.
      openApiParameters.forEach(({ in: location, name, schema }, i) => {
        const parameterPath = [ ...operationPath, 'parameters', i ];

        // Skip this parameter if it has no schema.
        if (!schema) {
          return;
        }

        expectJsonSchemaValid(schema, `schema for ${location} parameter ${name} for operation ${operationDescription} (path ${jsonPointer.compile(parameterPath)})`);
      });
    });
  });
});

/**
 * Iterates over all operations defined in the OpenAPI document.
 *
 * @param {Function} callback - Iterator function that will be called with the
 * current OpenAPI operation, the current path in the OpenAPI document (as an
 * array), and a string description of the operation for inclusion into error
 * messages.
 */
function eachOpenApiOperation(callback) {
  for (const urlPath in dereferencedOpenApiDocument.paths) {
    const openApiPath = dereferencedOpenApiDocument.paths[urlPath];
    for (const httpMethod in openApiPath) {
      const openApiOperation = openApiPath[httpMethod];
      const operationDescription = `${httpMethod.toUpperCase()} ${urlPath}`;
      callback(openApiOperation, [ 'paths', urlPath, httpMethod ], operationDescription);
    }
  }
}

function expectJsonSchemaValid(schema, description) {
  if (isPlainObject(schema)) {
    expectJsonSchemaEnumHasType(schema, description);
    // Recursively check the values of a schema object.
    Object.values(schema).forEach(value => expectJsonSchemaValid(value, description));
  } else if (isArray(schema)) {
    // Recursively check array values.
    schema.forEach(value => expectJsonSchemaValid(value, description));
  }

  // If the argument is any other type of JSON value, stop recursing.
}

function expectJsonSchemaEnumHasType({ enum: enumValues, type }, description) {
  if (enumValues && !type) {
    throw new Error(`The "enum" keyword must be accompagnied by "type" for correct display in the Swagger UI documentation (${description})`);
  }
}
