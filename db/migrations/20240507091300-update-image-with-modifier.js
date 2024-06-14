'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('images', 'image_modifiers', {
      type: Sequelize.DataTypes.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('images', 'image_modifiers', {
      type: Sequelize.DataTypes.JSON
    });
  }
};
