'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'last_login', {
      type: Sequelize.DataTypes.DATE
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'last_login', {
      type: Sequelize.DataTypes.DATE
    });
  }
};
