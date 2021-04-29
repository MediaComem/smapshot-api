'use strict';

const { irreversibleMigration, rawSqlMigration } = require('../utils');

module.exports = {
  up: rawSqlMigration(__filename, 'up'),
  down: irreversibleMigration(__filename)
};
