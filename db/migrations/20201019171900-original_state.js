'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('images', 'original_state', {
        type: Sequelize.DataTypes.TEXT,
        defaultValue: 'initial'
    });
    await queryInterface.sequelize.query(`
        ALTER TABLE images ADD CONSTRAINT original_state_check CHECK ((state = ANY (ARRAY['initial'::text, 'waiting_alignment'::text, 'waiting_validation'::text, 'validated'::text, 'impossible'::text])));
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('images', 'original_state', {
        type: Sequelize.DataTypes.TEXT,
        defaultValue: 'initial'
    });
    await queryInterface.sequelize.query(`
        ALTER TABLE images DROP CONSTRAINT original_state_check;
    `);
  }
};
