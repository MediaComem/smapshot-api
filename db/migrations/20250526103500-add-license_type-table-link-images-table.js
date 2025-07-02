'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public.license_type (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        description TEXT,
        url TEXT
      );
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO public.license_type (name, code, description, url) VALUES
        ('CC BY', 'by', 'Attribution', 'https://creativecommons.org/licenses/by/4.0/'),
        ('CC BY-SA', 'by-sa', 'Attribution-ShareAlike', 'https://creativecommons.org/licenses/by-sa/4.0/'),
        ('CC BY-ND', 'by-nd', 'Attribution-NoDerivs', 'https://creativecommons.org/licenses/by-nd/4.0/'),
        ('CC BY-NC', 'by-nc', 'Attribution-NonCommercial', 'https://creativecommons.org/licenses/by-nc/4.0/'),
        ('CC BY-NC-SA', 'by-nc-sa', 'Attribution-NonCommercial-ShareAlike', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'),
        ('CC BY-NC-ND', 'by-nc-nd', 'Attribution-NonCommercial-NoDerivs', 'https://creativecommons.org/licenses/by-nc-nd/4.0/'),
        ('Public Domain (CC0)', 'cc0', 'Creative Commons Zero – Public Domain Dedication', 'https://creativecommons.org/publicdomain/zero/1.0/'),
        ('Other', 'other', 'License is unknown, custom, or not categorized.', NULL),
        ('Restricted', 'restricted', 'Use is not permitted due to legal or policy restrictions.', NULL);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD COLUMN license_type_id INTEGER;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD CONSTRAINT fk_license_type
      FOREIGN KEY (license_type_id)
      REFERENCES public.license_type(id);
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP CONSTRAINT IF EXISTS fk_license_type;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN IF EXISTS license_type_id;
    `);
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS public.license_type;
    `);
  },
};
