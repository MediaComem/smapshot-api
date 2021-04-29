/* eslint-disable node/no-unpublished-require */
const waitPort = require('wait-port');

const config = require('../config');
const logger = require('../config/logger');

Promise.resolve().then(waitForTheDatabase).catch(err => {
  logger.error(err);
  process.exit(1);
});

async function waitForTheDatabase() {
  await waitPort({
    host: config.database.host,
    port: config.database.port
  });
}
