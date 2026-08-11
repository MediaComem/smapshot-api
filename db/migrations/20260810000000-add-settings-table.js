'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id SERIAL PRIMARY KEY NOT NULL,
        name VARCHAR(255) NOT NULL UNIQUE,
        value JSON NOT NULL
      );
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO public.settings (name, value) VALUES
        ('maintenance_mode', 'false'),
        ('banner_criticality', '"warn"'),
        ('maintenance_message', '{"de": "", "en": "", "fr": "", "it": "", "pt": "", "ja": ""}');
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS public.settings;
    `);
  },
};
