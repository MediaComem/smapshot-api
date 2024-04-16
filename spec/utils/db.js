const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../app/models");

/**
 * A list of the main tables in the database, excluding join tables. This list
 * should be kept up to date when tables are added or removed in migrations.
 */
exports.mainDatabaseTables = [
  "apriori_locations",
  "collections",
  "corrections",
  "countries",
  "errors_type",
  "geolocalisations",
  "images",
  "images_downloads",
  "images_views",
  "news",
  "observations",
  "owners",
  "photographers",
  "problems",
  "problems_type",
  "users",
];

/**
 * Counts the number of rows in the database.
 *
 * @returns {Object.<string, number>} An object with table names as keys and row
 * counts as values.
 */
exports.countDatabaseRows = async () => {
  const tables = exports.mainDatabaseTables;

  // Count the number of rows in all tables in parallel.
  const counts = await Promise.all(
    tables.map(async (table) => {
      const rows = await sequelize.query(
        `SELECT COUNT(*) AS count FROM ${table}`,
        { type: QueryTypes.SELECT }
      );

      return rows[0].count;
    })
  );

  // Turn the resulting counts array into an object with table names as keys.
  return counts.reduce(
    (memo, count, index) => ({ ...memo, [tables[index]]: count }),
    {}
  );
};

/**
 * Wipes all data so that each test can start from a clean slate. This function
 * may need to be updated every time a table is added, renamed or removed.
 */
exports.resetDatabase = () =>
  sequelize.query(`
  TRUNCATE users RESTART IDENTITY CASCADE;
  TRUNCATE photographers RESTART IDENTITY CASCADE;
  TRUNCATE stories RESTART IDENTITY CASCADE;
  TRUNCATE news RESTART IDENTITY CASCADE;
`);
