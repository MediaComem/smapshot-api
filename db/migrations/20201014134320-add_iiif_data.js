'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('images', 'iiif_data', {
      type: Sequelize.DataTypes.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('images', 'iiif_data', {
      type: Sequelize.DataTypes.JSON
    });
  }
};
