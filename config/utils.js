const { URL } = require('url');

/**
 * Returns the value of an environment variable. By default, the variable is
 * required to be set in the environment unless a default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {*} [options.default] - The default value to return if the environment
 * variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {*} The value of the environment variable, or the default value if
 * provided and the variable was not set.
 * @throws If the environment variable is required and not set.
 */
exports.parseEnv = (varname, options = {}) => {

  const defaultValue = options.default;
  const required = options.required !== undefined ? options.required : defaultValue === undefined;

  const value = process.env[varname];
  if (value === undefined && required) {
    throw new Error(`Environment variable $${varname} is required`);
  }

  return value !== undefined ? value : defaultValue;
};

/**
 * Returns the value of a boolean environment variable. By default, the variable
 * is required to be set in the environment unless a default value is provided.
 *
 * The following values are considered valid booleans:
 *
 * * For true: `1`, `y`, `yes`, `t`, `true`.
 * * For false: `0`, `n`, `no`, `f`, `false`.
 *
 * Any other value will be considered invalid.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {boolean} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {boolean} The value of the environment variable, or the default
 * value if provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not a valid boolean.
 */
exports.parseEnvBoolean = (varname, options = {}) => {

  const value = exports.parseEnv(varname, options);
  if (value === undefined) {
    // Do not check the value if it is not required.
    return;
  } else if (/^1|y|yes|t|true$/.exec(value)) {
    return true;
  } else if (/^0|n|no|f|false$/.exec(value)) {
    return false;
  }

  throw new Error(`Environment variable $${varname} must be a boolean`);
}

/**
 * Returns the value of an environment variable that is supposed to be an email.
 * By default, the variable is required to be set in the environment unless a
 * default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {string} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {*} The value of the environment variable, or the default value if
 * provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not an email address.
 */
exports.parseEnvEmail = (varname, options = {}) => {

  const value = exports.parseEnv(varname, options);
  if (value === undefined) {
    // Do not check the value if it is not required.
    return;
  // https://davidcel.is/posts/stop-validating-email-addresses-with-regex/
  } else if (!/^.+@.+\..+$/.exec(value)) {
    throw new Error(`Environment variable $${varname} must be an email address, but its value is ${JSON.stringify(value)}`);
  }

  return value;
}

/**
 * Returns the value of an environment value that is supposed to be among the
 * provided set of values. By default, the variable is required to be set in the
 * environment unless a default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} options - Options.
 * @param {string[]} options.allowed - The set of allowed values.
 * @param {string} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {string} The value of the environment variable, or the default value
 * if provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not among the allowed values.
 */
exports.parseEnvEnum = (varname, options = {}) => {

  const allowed = options.allowed;

  const value = exports.parseEnv(varname, options);
  if (value === undefined) {
    // Do not check the value if it is not required.
    return;
  } else if (!allowed.includes(value)) {
    throw new Error(`Environment variable $${varname} is ${JSON.stringify(value)} but it must be one of the following values: ${allowed.join(', ')}`);
  }

  return value;
}

/**
 * Returns the value of an environment variable that is supposed to be an HTTP
 * or HTTPS URL (without a trailing slash). By default, the variable is required
 * to be set in the environment unless a default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {string} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {string} The value of the environment variable, or the default value
 * if provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not an HTTP or HTTPS URL, or if it ends with a slash.
 */
exports.parseEnvHttpUrl = (varname, options = {}) => {

  const value = exports.parseEnv(varname, options);
  if (value === undefined) {
    // Do not check the value if it is not required.
    return;
  }

  let url;
  try {
    url = new URL(value);
  } catch (err) {
    throw new Error(`Environment variable $${varname} must be a valid HTTP URL without a trailing slash, but its value is ${err.message}`);
  }

  if(!/^https?:$/.exec(url.protocol)) {
    throw new Error(`Environment variable $${varname} must be an HTTP URL without a trailing slash, but its value is ${value}`);
  } else if (/\/$/.exec(value)) {
    throw new Error(`Environment variable $${varname} must be an HTTP URL without a trailing slash, but its value is ${value}`);
  }

  return value;
}

/**
 * Returns the value of an integer environment variable, optionally enforcing it
 * to be within the specified bounds. By default, the variable is required to be
 * set in the environment unless a default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {number} [options.min] - The minimum value (inclusive).
 * @param {number} [options.max] - The maximum value (inclusive).
 * @param {number} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {number} The value of the environment variable, or the default value
 * if provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not an integer, or if it is not within the specified bounds.
 */
exports.parseEnvInteger = (varname, options = {}) => {

  const value = exports.parseEnv(varname, options);
  if (value === undefined) {
    // Do not check the value if it is not required.
    return;
  }

  const min = options.min !== undefined ? options.min : Number.MIN_SAFE_INTEGER;
  const max = options.max !== undefined ? options.max : Number.MAX_SAFE_INTEGER;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Environment variable $${varname} must be a valid integer between ${min} and ${max}`);
  }

  return parsed;
}

/**
 * Returns the value of an environment variable that is supposed to be a port
 * number. By default, the variable is required to be set in the environment
 * unless a default value is provided.
 *
 * @param {string} varname - The name of the environment variable.
 * @param {Object} [options] - Options.
 * @param {number} [options.default] - The default value to return if the
 * environment variable is not set.
 * @param {boolean} [options.required] - Whether the environment variable must
 * be set. This defaults to true if no default value is provided with the
 * `default` option, false otherwise.
 * @returns {number} The value of the environment variable, or the default value
 * if provided and the variable was not set.
 * @throws If the environment variable is required and not set, or if its value
 * is not a valid port number.
 */
exports.parseEnvPort = (varname, options = {}) => {
  return exports.parseEnvInteger(varname, {
    ...options,
    min: 1,
    max: 65535
  });
}

/**
 * Returns the provided URL without its path, query string or hash fragment.
 *
 * @param {string} urlString - The URL to transform.
 * @returns {string} The base URL.
 */
exports.toBaseUrl = urlString => {
  const url = new URL(urlString);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString();
};
