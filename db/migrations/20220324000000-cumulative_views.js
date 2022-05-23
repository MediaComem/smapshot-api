'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE public.geolocalisations
        ADD COLUMN region_px integer[];
    `);

    await queryInterface.sequelize.query(`
        CREATE DOMAIN public.images_framing_mode AS text
          CONSTRAINT valid_images_framing_mode CHECK ((VALUE = ANY (ARRAY['single_image'::text, 'composite_image'::text])));
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE public.images
        ADD COLUMN framing_mode images_framing_mode;
    `);

    //+ TO DO fill framing_mode with "single_image" for all images already in DB

  },
  
  down: async (queryInterface) => { // /!\ the path to the gltfs will not be correct anymore for the images geolocalised with a region cropping
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geolocalisations
      DROP COLUMN region_px;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN framing_mode;
    `);

    await queryInterface.sequelize.query(`
      DROP DOMAIN images_framing_mode;
    `);

  }
};