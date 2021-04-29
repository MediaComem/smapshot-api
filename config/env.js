const path = require('path');

const { parseEnvEnum } = require('./utils');

const environments = Object.freeze([ 'development', 'production', 'test' ]);
const env = parseEnvEnum('NODE_ENV', { allowed: environments, default: 'development' });
const projectRootDirectory = path.resolve(path.join(__dirname, '..'));

// Load dotenv files before retrieving configuration from the environment. This
// is only for development and testing, not production.
//
// 3 files are loaded for the current environment. For example, for the
// `development` environment:
//
// * `.env.development` (highest precedence)
// * `.env.development.defaults`
// * `.env` (lowest precedence)
//
// The first value found is used for a given variable (e.g. if a variable is
// defined in `.env.development`, it takes precedence over the same variable in
// `.env.development.defaults` and `.env`). Note that if an environment variable
// is already set in your environment, it will not be overwritten.
//
// The first and last files are in the `.gitignore` file, while the middle one
// (the one that ends with `.defaults`) is under version control. This allows
// environment-specific defaults to be committed into this repository while
// still allowing every developer to override them with ignored configuration
// files specific to their environment.
const dotenv = requireOptional('dotenv');
if (dotenv) {
  for (const dotenvBasename of [ `.env.${env}`, `.env.${env}.defaults`, '.env' ]) {
    dotenv.config({ path: path.join(projectRootDirectory, dotenvBasename) });
  }
}

exports.env = env;
exports.root = projectRootDirectory;

/**
 * Requires an optional npm package, returning undefined if the package is not
 * installed.
 *
 * @param {string} name - The name of the package to require.
 * @returns {*} The required package or undefined.
 */
function requireOptional(name) {
  try {
    return require(name);
  } catch (err) {
    // Ignore any error since the dependency is optional.
  }
}
