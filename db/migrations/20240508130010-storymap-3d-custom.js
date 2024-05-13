'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('stories_chapters', 'view_custom', {
      type: Sequelize.DataTypes.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('stories_chapters', 'view_custom', {
      type: Sequelize.DataTypes.JSON
    });
  }
};
