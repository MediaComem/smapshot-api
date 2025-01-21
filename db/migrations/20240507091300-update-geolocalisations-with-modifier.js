'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('geolocalisations', 'image_modifiers', {
      type: Sequelize.DataTypes.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('geolocalisations', 'image_modifiers', {
      type: Sequelize.DataTypes.JSON
    });
  }
};
