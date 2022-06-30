'use strict';

const { irreversibleMigration } = require('../utils');

module.exports = {
  up: async (queryInterface) => {
    // collection_id = 36 := SARI
    await queryInterface.sequelize.query(`
        UPDATE images SET framing_mode = 'single_image' WHERE framing_mode IS NULL;
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE images ALTER COLUMN framing_mode SET NOT NULL;
        ALTER TABLE images ALTER COLUMN framing_mode SET DEFAULT 'single_image';
    `);
  },

  down: irreversibleMigration(__filename)

};