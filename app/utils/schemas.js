const path = require('path');

const config = require('../../config');

// All JSON schemas must have been assembled into one main JSON
// file prior to starting the application. This should be handled automatically
// during development and testing. You can also manually run `npm run schemas`.
const schemasFile = path.join(config.generatedDir, 'schemas.json');

/**
 * All JSON schemas in this API.
 */
exports.schemas = require(schemasFile);

/**
 * Retrieves a JSON schema by its $id from this API's main schemas file.
 *
 * @param {string} name - The identifier of one of the JSON schemas in the
 * OpenAPI document's `/components/schemas` property.
 */
exports.getJsonSchema = name => {

  const schema = exports.schemas.find(schema => schema && schema.$id === name);
  if (!schema) {
    throw new Error(`Schema with $id ${JSON.stringify(name)} not found in "${schemasFile}"`);
  }

  return schema;
};
