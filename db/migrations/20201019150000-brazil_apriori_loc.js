'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('apriori_locations', 'azimuth', {
        type: Sequelize.DataTypes.DECIMAL,
        allowNull: true
    });
    await queryInterface.addColumn('apriori_locations', 'exact', {
        type: Sequelize.DataTypes.BOOLEAN,
        defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('apriori_locations', 'azimuth', {
        type: Sequelize.DataTypes.DECIMAL,
        allowNull: true
    });
    await queryInterface.removeColumn('apriori_locations', 'exact', {
        type: Sequelize.DataTypes.BOOLEAN
    });
  }
};
