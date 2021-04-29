'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE images DROP CONSTRAINT state_check;
      UPDATE images SET state = 'initial' WHERE state = 'not_georef';
      ALTER TABLE images ADD CONSTRAINT state_check CHECK ((state = ANY (ARRAY['initial'::text, 'waiting_alignment'::text, 'waiting_validation'::text, 'validated'::text, 'impossible'::text])));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE images DROP CONSTRAINT state_check;
      UPDATE images SET state = 'not_georef' WHERE state = 'initial';
      ALTER TABLE images ADD CONSTRAINT state_check CHECK ((state = ANY (ARRAY['not_georef'::text, 'waiting_validation'::text, 'validated'::text, 'impossible'::text])));
    `);
  }
};
