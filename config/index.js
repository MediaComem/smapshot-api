/**
 * This is the main configuration file for this project. All configuration
 * should be loaded here, and all code which needs configuration should require
 * this file to obtain it.
 */

// ATTENTION: Make sure this require remains at the top, so that .env files are
// loaded before accessing environment variables when developing or testing.
const { env, root } = require('./env');

const { parseEnv, parseEnvBoolean, parseEnvEmail, parseEnvInteger, parseEnvPort, toBaseUrl } = require('./utils');
const { apiProductionUrl, apiUrl, generatedDir, port } = require('./precompile');

// Configuration
// =============

/**
 * Options used to configure ajv, the JSON schema validator used in this API.
 * See https://github.com/ajv-validator/ajv#options.
 */
exports.ajv = {
  allErrors: true,
  jsonPointers: true
};

exports.apiUrl = apiUrl;
exports.apiProductionUrl = apiProductionUrl;

exports.bcryptRounds = parseEnvInteger('BCRYPT_ROUNDS', {
  default: 12,
  // Require a minimum number of iterations in production, but allow tests to
  // use as few iterations as possible for speed.
  min: env === 'test' ? 1 : 10
});

exports.database = {
  name: parseEnv('DB_NAME', { default: 'smapshot' }),
  host: parseEnv('DB_HOST', { default: 'localhost' }),
  port: parseEnvPort('DB_PORT', { default: 5432 }),
  username: parseEnv('DB_USER', { default: 'smapshot' }),
  password: parseEnv('DB_PASS', { required: false }),
  postgresPassword: parseEnv('POSTGRES_PASSWORD', { required: false })
};

exports.env = env;

exports.facebookAuth = {
  appId: parseEnv('AUTH_FACEBOOK_APP_ID', { required: false }),
  appSecret: parseEnv('AUTH_FACEBOOK_APP_SECRET', { required: false })
};

exports.googleAuth = {
  clientId: parseEnv('AUTH_GOOGLE_CLIENT_ID', { required: false }),
  clientSecret: parseEnv('AUTH_GOOGLE_CLIENT_SECRET', { required: false })
}

exports.jwtSecret = parseEnv('JWT_SECRET');

exports.port = port;

exports.generatedDir = generatedDir;
exports.root = root;

// Return URLs allowed when registering or requesting a new password. This
// defaults to the same base URL as the API (assuming all components are behind
// a reverse proxy), but can be customized if necessary.
const returnUrlsString = parseEnv('RETURN_URLS', { required: false }) || toBaseUrl(apiUrl);
exports.returnUrls = returnUrlsString.split(',');

exports.smtp = {
  from: parseEnvEmail('MAIL_FROM'),
  host: parseEnv('MAIL_HOST'),
  port: parseEnvPort('MAIL_PORT', { default: 587 }),
  secure: parseEnvBoolean('MAIL_SECURE', { default: true }),
  username: parseEnv('MAIL_USER', { required: false }),
  password: parseEnv('MAIL_PASS', { required: false }),
  allowInvalidCertificate: parseEnvBoolean('MAIL_ALLOW_INVALID_CERTIFICATE', { default: false })
};

exports.proxyGeoreferencerMode = parseEnvBoolean('PROXY_GEOREFERENCER_MODE', { required: false });

exports.timezone = parseEnv('TZ', { required: false });
