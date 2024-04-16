'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.addColumn('stories', 'description', {
      type: Sequelize.DataTypes.STRING
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.removeColumn('stories', 'description', {
      type: Sequelize.DataTypes.STRING
    });
  }
};
