'use strict';

const { irreversibleMigration } = require('../utils');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE geolocalisations ALTER COLUMN footprint
        TYPE geometry('MultiPolygon',4326,2)
        USING ST_Multi(footprint);
    `);
  },

  down: irreversibleMigration(__filename)
};
