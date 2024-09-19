"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY NOT NULL,
        title JSON NOT NULL,
        description JSON NOT NULL,
        description_preview JSON NOT NULL,
        img_url VARCHAR(255),
        img_alt JSON,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS news;
    `);
  },
};
