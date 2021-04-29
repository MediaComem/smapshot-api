const { difference, get, isPlainObject } = require('lodash');

const { countDatabaseRows, mainDatabaseTables } = require('../utils/db');
const { expect } = require('../utils/chai');

/**
 * Verifies that the number of rows in the database has changed by the expected
 * amounts.
 *
 *     // Check that the database contains 2 fewer collections and 1 additional
 *     // user. Any table not included is expected to still have the same number
 *     // of rows as before (i.e. the change is 0).
 *     expectDatabaseCountsChangedBy({
 *       collections: -2,
 *       users: 1
 *     });
 *
 * The comparison is made assuming that the database initially contains nothing.
 * If you have inserted database fixtures in your test, you should get the
 * initial counts before making your test and using this function:
 *
 *     const { countDatabaseRows } = require('path/to/spec/utils/db');
 *
 *     it('should test something', function() {
 *       // Set up your test data.
 *       await createUser();
 *
 *       // Retrieve the initial counts after inserting fixtures.
 *       const initialCounts = await countDatabaseRows();
 *
 *       // Do the test magic...
 *       // Assuming the test will delete 2 collections.
 *
 *       // Check the expected changes in database row counts compared to the
 *       // initial counts.
 *       expectDatabaseCountsChangedBy({
 *         // Assuming the test did not insert or delete a user, the expected
 *         // change is 0 because there was 1 user in the database before and
 *         // there is still 1 now. You may also simply omit the "users" key in
 *         // this case.
 *         users: 0,
 *         collections: -2
 *       }, initialCounts);
 *     });
 *
 * Note: this assertion cannot detect the fact that a row was inserted and later
 * deleted, or the reverse, unless the assertion is also made between the
 * insertion and deletion. It also cannot detect updates.
 *
 * @param {Object.<string, number>} changes - The expected changes in row
 * counts. This is an object with table names as keys and the expected changes
 * as values.
 * @param {Object.<string, number>} initialCounts - The initial row counts to
 * use as a base for counting the number of actual changes. If not specified,
 * the database is assumed to contain nothing.
 */
exports.expectDatabaseCountsChangedBy = async (changes = {}, initialCounts = {}) => {
  ensureDatabaseRowCountsValid(changes);
  ensureDatabaseRowCountsValid(initialCounts);

  const currentCounts = await countDatabaseRows();
  const actualChanges = mainDatabaseTables.reduce(
    (memo, table) => ({ ...memo, [table]: currentCounts[table] - get(initialCounts, table, 0) }),
    {}
  );

  const expectedChanges = mainDatabaseTables.reduce(
    (memo, table) => ({ ...memo, [table]: get(changes, table, 0) }),
    {}
  );

  expect(actualChanges, 'changes in the database').to.deep.equal(expectedChanges);
};

/**
 * Verifies that the number of rows in the database has not changed. This is a
 * convenience function that calls `expectDatabaseCountsChangedBy` with no
 * expected changes.
 *
 * @param {Object.<string, number>} initialCounts - The initial row counts to
 * use as a base for counting the number of actual changes. If not specified,
 * the database is assumed to contain nothing.
 */
exports.expectDatabaseCountsNotChanged = async (initialCounts = {}) => {
  return exports.expectDatabaseCountsChangedBy({}, initialCounts);
};

function ensureDatabaseRowCountsValid(counts) {
  if (!isPlainObject(counts)) {
    throw new Error('Database row counts must be an object');
  }

  const unknownTables = difference(Object.keys(counts), mainDatabaseTables);
  if (unknownTables.length) {
    throw new Error(`Unknown database tables: ${unknownTables.map(table => JSON.stringify(table)).join(', ')} (remember to update the hardcoded list of database tables if you have recently added a table)`);
  }
}
