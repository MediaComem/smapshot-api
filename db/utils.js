const { existsSync, readFile } = require('fs-extra');
const path = require('path');

const { root } = require('../config');

/**
 * Returns a function that can be used as a Sequelize migration's `down`
 * callback, throwing an error to indicate that the migration cannot be
 * reverted.
 *
 *     const { irreversibleMigration } = require('../utils');
 *
 *     module.exports = {
 *       up: async queryInterface => {
 *         // ...
 *       },
 *       down: irreversibleMigration(__filename)
 *     };
 *
 * @param {string} migrationFile - The path to the migration file (which can be
 * obtained from the `__filename` variable within the migration file).
 * @returns {Function} A Sequelize migration callback.
 */
exports.irreversibleMigration = migrationFile => {
  return async () => {
    throw new Error(`Migration ${path.relative(root, migrationFile)} cannot be reverted`);
  };
};

/**
 * Returns a function that can be used as a Sequelize migration's `up` or `down`
 * callback, and which will run a raw SQL file. This can be used instead of
 * writing JavaScript migrations with Sequelize's query interface.
 *
 *     const { rawSqlMigration } = require('../utils');
 *
 *     module.exports = {
 *       up: rawSqlMigration(__filename, 'up'),
 *       down: rawSqlMigration(__filename, 'down')
 *     };
 *
 * The raw SQL file for the `up` migration is expected to have the same filename
 * as the Sequelize migration file with the `.js` extension replaced by
 * `.up.sql` (e.g. `1234-some-migration.js` becomes
 * `1234-some-migration.up.sql`). Similarly, replace `.js` with `.down.sql` for
 * the down migration.
 *
 * @param {string} migrationFile - The path to the migration file (which can be
 * obtained from the `__filename` variable within the migration file).
 * @param {("up"|"down")} migrationType - The type of migration ("up" to perform
 * the migration or "down" to revert it).
 * @returns {Function} A Sequelize migration callback.
 */
exports.rawSqlMigration = (migrationFile, migrationType) => {
  if (!existsSync(migrationFile)) {
    throw new Error(`Migration file must be an existing migration but ${JSON.stringify(migrationFile)} does not exist`);
  } else if (![ 'down', 'up' ].includes(migrationType)) {
    throw new Error(`Migration type must be "up" or "down", but the provided type was ${JSON.stringify(migrationType)}`);
  }

  return async queryInterface => {
    const sql = await readRawSqlMigrationFile(migrationFile, migrationType);
    await queryInterface.sequelize.query(sql, { raw: true });
  };
};

async function readRawSqlMigrationFile(migrationFile, migrationType) {

  // The SQL file is assumed to have the same name as the JavaScript migration
  // file but with the `.sql` extension.
  const sqlFile = migrationFile.replace(/\.[^.]+$/, `.${migrationType}.sql`);

  try {
    return await readFile(sqlFile, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }

    throw new Error(`Could not find SQL file ${path.relative(root, sqlFile)} for migration file ${path.relative(root, migrationFile)}`);
  }
}
