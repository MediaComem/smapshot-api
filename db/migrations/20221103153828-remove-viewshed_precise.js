'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata
      DROP COLUMN viewshed_precise;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN viewshed_precise;
    `);
  },
  
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata
      ADD COLUMN viewshed_precise Geometry('MultiPolygon',4326,2) DEFAULT NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD COLUMN viewshed_precise Geometry('MultiPolygon',4326,2) DEFAULT NULL;
    `);
  }
};
