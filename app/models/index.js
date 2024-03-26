require('pg').defaults.parseInt8 = true;

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const config = require('../../config');
const logger = require('../../config/logger');

const environmentsWithDatabaseLogs = [ 'development', 'test' ];

const sequelize = new Sequelize(
  config.database.name,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: 'postgres',
    define: {
      underscored: true,
      // Must be false, else it want to fill the fields date_created, date_updated which doesnt exists
      timestamps: false
    },
    logging: environmentsWithDatabaseLogs.includes(config.env) ? message => logger.debug(message) : false,
    timezone: config.timezone
  }
);

const db = {};
// read the files within the folder and add the tables
fs.readdirSync(__dirname)
  .filter(file => file.indexOf('.') !== 0 && file !== 'index.js')
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes)
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
