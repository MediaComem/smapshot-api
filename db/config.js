const { database, env } = require('../config');

/**
 * Configuration to run database migrations with the Sequelize command-line
 * interface. Also see the `.sequelizerc` file at the root of this repository.
 *
 * * https://github.com/sequelize/cli#readme
 * * https://sequelize.org/master/manual/migrations.html#configuration
 * * https://sequelize.org/master/manual/migrations.html#dynamic-configuration
 */
module.exports = {
  [env]: {
    // Connection settings
    dialect: 'postgres',
    host: database.host,
    port: database.port,
    database: database.name,
    username: database.username,
    password: database.password,
    // Other settings
    logging: env !== 'test',
    migrationStorageTableName: 'sequelize_meta',
  }
};
