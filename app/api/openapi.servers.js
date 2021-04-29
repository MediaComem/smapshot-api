const config = require('../../config/precompile'); // Use precompile configuration.

/**
 * This file exports an array of valid Server Objects according to the OpenAPI
 * specification (see
 * https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#serverObject).
 * They are meant to be included into this API's base OpenAPI document.
 */
const servers = [];

// Automatically document the local server.
servers.push({
  url: config.apiUrl,
  // Add a description when developing locally, to differentiate this server
  // from the production server.
  description: config.env === 'development' ? 'Local development API' : undefined
});

// If developing locally and the the production API URL is configured, add it as
// a server as well.
if (config.env === 'development' && config.apiProductionUrl) {
  servers.push({
    url: config.apiProductionUrl,
    description: 'Production API'
  });
}

module.exports = servers;
