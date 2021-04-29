const path = require('path');

const config = require('../../config');

// The base OpenAPI YAML document must have been assembled into the full JSON
// file prior to starting the application. This should be handled automatically
// during development and testing. You can also manually run `npm run openapi`.
const openApiFile = path.join(config.generatedDir, 'openapi.json');
const dereferencedOpenApiFile = path.join(config.generatedDir, 'openapi.dereferenced.json');

/**
 * The OpenAPI document for this API.
 */
exports.openApiDocument = require(openApiFile);

/**
 * The dereferenced OpenAPI document for this API.
 */
exports.dereferencedOpenApiDocument = require(dereferencedOpenApiFile);
