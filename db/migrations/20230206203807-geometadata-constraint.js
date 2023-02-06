'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata DROP CONSTRAINT IF EXISTS fk_image_id_unique;
      ALTER TABLE public.geometadata ADD CONSTRAINT fk_image_id_unique UNIQUE (fk_image_id);
    `);
  },
  
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata DROP CONSTRAINT IF EXISTS fk_image_id_unique;
    `);
  }
};
