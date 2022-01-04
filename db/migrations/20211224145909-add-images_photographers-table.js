'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS images_photographers (
        image_id INTEGER REFERENCES images (id) ON DELETE CASCADE ON UPDATE CASCADE,
        photographer_id INTEGER REFERENCES photographers (id) ON DELETE CASCADE ON UPDATE CASCADE,
        PRIMARY KEY (image_id,photographer_id)
      );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO public.images_photographers (image_id, photographer_id)
      SELECT img.id,img.photographer_id
      FROM images as img
      LEFT JOIN images_photographers as assoc ON assoc.image_id = img.id
      WHERE img.photographer_id IS NOT null AND assoc.image_id IS null;
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO public.images_photographers (image_id, photographer_id)
      SELECT img.id, 3
      FROM images as img
      LEFT JOIN images_photographers as assoc ON assoc.image_id = img.id
      WHERE img.photographer_id IS null AND assoc.image_id IS null;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE images
      DROP COLUMN photographer_id;
    `);
  },

  down: async (queryInterface) => { // /!\ not fully reversible

    await queryInterface.sequelize.query(`
      ALTER TABLE images
      ADD COLUMN photographer_id INTEGER;
    `);

    //if several photographers for one image, will only keep first (risk of data lost)
    await queryInterface.sequelize.query(`
      UPDATE images
      SET photographer_id = second_table.photographer_id
      FROM (
        SELECT * FROM images_photographers
        ) AS second_table
      WHERE images.id = second_table.image_id
    `);

    await queryInterface.sequelize.query(`
      DROP TABLE images_photographers;
    `);
  }
};
