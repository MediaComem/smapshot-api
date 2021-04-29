const { parseEnvBoolean, parseEnvInteger } = require('../config/utils');

/**
 * The seed used to randomize generated test data. It is printed to the console
 * every time the tests run. Use the `$SEED` environment variable to reproduce a
 * test run with a given seed value.
 */
exports.seed = parseEnvInteger('SEED', {
  min: 0,
  max: 1000 * 1000,
  required: false
});

/**
 * Whether to display detailed information about the coverage of the documented
 * API by automated tests. If false (the default), only a summary is displayed.
 */
exports.showOpenApiCoverage = parseEnvBoolean('SHOW_OPENAPI_COVERAGE', { required: false });
