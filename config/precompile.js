/**
 * This file contains the portion of the configuration which is required when
 * precompiling this application (e.g. assemble the full OpenAPI document).
 */

const path = require('path');

// ATTENTION: Make sure this require remains at the top, so that .env files are
// loaded before accessing environment variables when developing or testing.
// Also make sure to NEVER require `./index` here. The whole point of this file
// is to provide only the portion of the entire configuration needed for
// precompilation instead of the whole configuration.
const { root } = require('./env');

const { parseEnvEnum, parseEnvHttpUrl, parseEnvPort } = require('./utils');

const logLevels = Object.freeze([ 'silent', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly' ]);

const port = parseEnvPort('PORT', { default: 1337 });

exports.apiUrl = parseEnvHttpUrl('SMAPSHOT_API_URL') || `http://localhost:${port}`;
exports.apiProductionUrl = parseEnvHttpUrl('SMAPSHOT_API_PROD_URL', { required: false });
exports.generatedDir = path.join(root, 'app', 'generated');
exports.logLevel = parseEnvEnum('LOG_LEVEL', { allowed: logLevels, default: 'info' });
exports.port = port;
exports.root = root;
