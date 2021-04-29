// ATTENTION: Make sure this require remains at the top, so that .env files are
// loaded before accessing environment variables when developing or testing.
const { env } = require('./env');
const { parseEnv } = require('./utils');

if (env !== 'development') {
  throw new Error(`This configuration should only be required in the development environment (the current environment is ${JSON.stringify(env)})`);
}

exports.devUserPassword = parseEnv('DEV_USER_PASSWORD')
