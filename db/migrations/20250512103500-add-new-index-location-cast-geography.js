"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE INDEX images_location_geog_idx
      ON public.images
      USING GIST ((location::geography));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS images_location_geog_idx;
    `);
  },
};
