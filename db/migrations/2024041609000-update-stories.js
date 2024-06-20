'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.addColumn('stories', 'description', {
      type: Sequelize.DataTypes.TEXT
    });
    await queryInterface.addColumn('stories', 'owner_id', {
      type: Sequelize.DataTypes.INTEGER
    });
    await queryInterface.changeColumn('stories_chapters', 'description', {
      type: Sequelize.DataTypes.TEXT
    })
    await queryInterface.renameColumn("stories_chapters", "story", "story_id")
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('stories', 'description_preview', {
      type: Sequelize.DataTypes.STRING
    });
    await queryInterface.removeColumn('stories', 'description', {
      type: Sequelize.DataTypes.TEXT
    });
    await queryInterface.removeColumn('stories', 'owner_id', {
      type: Sequelize.DataTypes.INTEGER
    });
    await queryInterface.changeColumn('stories_chapters', 'description', {
      type: Sequelize.DataTypes.STRING
    })
    await queryInterface.renameColumn("stories_chapters", "story_id", "story")
  }
};
