"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY NOT NULL,
        title JSON NOT NULL,
        description JSON NOT NULL,
        description_preview JSON NOT NULL,
        img_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS news;
    `);
  },
};
