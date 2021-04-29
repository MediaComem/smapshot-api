const chalk = require('chalk');
const { reduce } = require('lodash');
const { after, before } = require('mocha');
const waitPort = require('wait-port');

const { sequelize } = require('../../app/models');
const config = require('../../config');
const { showOpenApiCoverage } = require('../config');
const { getApiCoverage } = require('./api');

let globalHooksEnabled = false;

/**
 * Sets up global Mocha hooks to execute code before and/or after the entire
 * test suite. This should be called from every integration test file.
 *
 * In this context, an integration test is defined as a test which integrates
 * with external systems such as the database.
 */
exports.setUpGlobalHooks = () => {

  // Make sure the hooks below are only set up once for the whole test suite.
  if (globalHooksEnabled) {
    return;
  }

  globalHooksEnabled = true;

  // Wait for the database to become available before running the test suite.
  // This is useful when running the tests through Docker Compose, in case the
  // database takes a while to start.
  before(waitForTheDatabase);

  // Print warnings if parts of the API were not tested or are not documented.
  after(checkApiCoverage);

  // The database connection must be closed once the test suite is done running,
  // or the test process will keep running forever.
  after(closeDatabaseConnection);
};

function checkApiCoverage() {
  const coverage = getApiCoverage();
  const { undocumented, untested } = coverage;

  const undocumentedCount = reduce(undocumented, (memo, value) => memo + value.length, 0);
  const untestedCount = reduce(untested, (memo, value) => memo + value.length, 0);
  if (undocumentedCount + untestedCount >= 1) {
    console.log(chalk.yellow(`There are ${undocumentedCount} undocumented and ${untestedCount} untested API element(s).`));
    if (!showOpenApiCoverage) {
      console.log(chalk.gray(`You can list them with: ${chalk.bold('npm run test:coverage')} or ${chalk.bold('npm run test:debug')}`));
      console.log(chalk.gray(`This is expected if you are excluding tests with ${chalk.bold('.only')} or ${chalk.bold('.skip')}.`));
    } else {
      console.log();
      printMissingApiCoverage(coverage);
    }
  }
}

async function closeDatabaseConnection() {
  await sequelize.close();
}

function printMissingApiCoverage({ undocumented, untested }) {
  const lines = [];

  for (const type of [ 'requests', 'headers', 'queryParams' ]) {

    // Print undocumented API elements.
    if (undocumented[type].length) {
      if (lines.length) {
        lines.push('');
      }

      lines.push(`The following ${chalk.yellow(type)} were tested but are not documented:`);
      for (const undocumentedElement of undocumented[type]) {
        lines.push(`* ${undocumentedElement}`);
      }
    }

    // Print untested API elements.
    if (untested[type].length) {
      if (lines.length) {
        lines.push('');
      }

      lines.push(`The following ${chalk.yellow(type)} are documented but have not been tested:`);
      for (const untestedElement of untested[type]) {
        lines.push(`* ${untestedElement}`);
      }
    }
  }

  console.log(lines.join('\n'));
}

async function waitForTheDatabase() {

  // Allow more time than the default Mocha timeout of 2 seconds.
  this.timeout(30000);

  await waitPort({
    host: config.database.host,
    port: config.database.port
  });

  // Print some blank lines to separate the output of wait-port from the test
  // suite's.
  console.log('\n');
}
