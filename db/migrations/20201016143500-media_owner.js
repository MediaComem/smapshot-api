'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('owners', 'banner_col_id', {
      type: Sequelize.DataTypes.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('owners', 'banner_col_id', {
      type: Sequelize.DataTypes.JSON
    });
  }
};
