'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE public.geolocalisations
        ADD COLUMN region_px integer[];
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD COLUMN cumulative_views BOOLEAN;
    `);
  },
  
  down: async (queryInterface) => { // /!\ the path to the gltfs will not be correct anymore for the images geolocalised with a region cropping
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geolocalisations
      DROP COLUMN region_px;
  `);

  await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN cumulative_views;
    `);
  }
};