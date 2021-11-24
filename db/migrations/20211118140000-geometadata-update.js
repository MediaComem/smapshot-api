'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE geometadata DROP COLUMNS (
        git_revision_hash
      );
      ALTER TABLE geometadata ADD COLUMNS (
        viewshed_git_revision_hash BYTEA DEFAULT NULL,
        toponyms_iterations INTEGER DEFAULT NULL,
        toponyms_count numeric[] DEFAULT NULL,
        toponyms_factors numeric[] DEFAULT NULL,
        toponyms_git_revision_hash BYTEA DEFAULT NULL
      );
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE geometadata ADD COLUMNS (
        git_revision_hash BYTEA DEFAULT NULL
      );
      ALTER TABLE geometadata DROP COLUMNS (
        viewshed_git_revision_hash,
        toponyms_iterations,
        toponyms_count,
        toponyms_factors,
        toponyms_git_revision_hash
      );
    `);
  }
};
