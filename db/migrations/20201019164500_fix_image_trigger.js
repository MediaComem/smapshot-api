'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER update_image_country_trigger ON images;
      CREATE TRIGGER update_image_country_trigger AFTER UPDATE OF location ON images
      FOR EACH ROW EXECUTE PROCEDURE update_image_country();
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
        DROP TRIGGER update_image_country_trigger ON images;
        CREATE TRIGGER update_image_country_trigger AFTER UPDATE ON images
        FOR EACH ROW EXECUTE PROCEDURE update_image_country();
    `);
  }
};



