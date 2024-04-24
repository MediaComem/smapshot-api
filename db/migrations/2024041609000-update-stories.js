'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.addColumn('stories', 'description', {
      type: Sequelize.DataTypes.TEXT
    });
    await queryInterface.changeColumn('stories_chapters', 'description', {
      type: Sequelize.DataTypes.TEXT
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.removeColumn('stories', 'description', {
      type: Sequelize.DataTypes.TEXT
    });
    await queryInterface.changeColumn('stories_chapters', 'description', {
      type: Sequelize.DataTypes.STRING
    })
  }
};
