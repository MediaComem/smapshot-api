'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD COLUMN tilt_shift boolean;
    `);

    await queryInterface.sequelize.query(`
        UPDATE public.images SET tilt_shift = false WHERE tilt_shift IS NULL;
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE public.images ALTER COLUMN tilt_shift SET NOT NULL;
        ALTER TABLE public.images ALTER COLUMN tilt_shift SET DEFAULT false;
    `);
  },

  down: async (queryInterface) => { 

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN tilt_shift;
    `);

  }
};

