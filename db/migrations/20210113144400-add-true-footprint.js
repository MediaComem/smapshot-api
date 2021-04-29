'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('images', 'footprint', {
      type: Sequelize.DataTypes.GEOMETRY('MultiPolygon,4326,2')
    });
    await queryInterface.sequelize.query(`
          UPDATE images SET footprint = viewshed_simple;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('images', 'footprint', {
      type: Sequelize.DataTypes.GEOMETRY('MultiPolygon,4326,2')
    });
  }
};
