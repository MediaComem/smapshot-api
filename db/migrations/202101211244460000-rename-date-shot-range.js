'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE images
        RENAME date_min TO date_shot_min;
    `);
    await queryInterface.sequelize.query(`
        ALTER TABLE images
        RENAME date_max TO date_shot_max;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE images
        RENAME date_shot_min TO date_min;
    `);
    await queryInterface.sequelize.query(`
        ALTER TABLE images
        RENAME date_shot_max TO date_max;
    `);
  }
};