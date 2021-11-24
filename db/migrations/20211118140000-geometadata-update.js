'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE geometadata DROP COLUMN git_revision_hash;
      ALTER TABLE geometadata
        ADD COLUMN viewshed_git_revision_hash BYTEA DEFAULT NULL,
        ADD COLUMN toponyms_iterations INTEGER DEFAULT NULL,
        ADD COLUMN toponyms_count numeric[] DEFAULT NULL,
        ADD COLUMN toponyms_factors numeric[] DEFAULT NULL,
        ADD COLUMN toponyms_git_revision_hash BYTEA DEFAULT NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE geometadata ADD COLUMN git_revision_hash BYTEA DEFAULT NULL;
      ALTER TABLE geometadata
        DROP COLUMN viewshed_git_revision_hash,
        DROP COLUMN toponyms_iterations,
        DROP COLUMN toponyms_count,
        DROP COLUMN toponyms_factors,
        DROP COLUMN toponyms_git_revision_hash;
    `);
  }
};
