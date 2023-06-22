'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS Stories (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        logo_link VARCHAR(255) NOT NULL
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS Stories_chapters (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(255) CHECK (type IN ('IMAGE', 'VIDEO', 'VIDEO-YOUTUBE', 'AUDIO')) NOT NULL,
        picture_id INTEGER NOT NULL
        CONSTRAINT fk_picture_id REFERENCES images(id),
        url_media TEXT NOT NULL,
        description TEXT NOT NULL,
        zoom INTEGER CHECK (zoom >= 0 AND zoom <= 22) NOT NULL,
        story INTEGER NOT NULL
        CONSTRAINT fk_story REFERENCES Stories(id),
        indexInStory INTEGER NOT NULL
      );
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP IF EXISTS TABLE Stories_chapters;
    `);
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS stories;
    `);
  }
};
