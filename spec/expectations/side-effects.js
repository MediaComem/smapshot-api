const { isEmpty } = require('lodash');

const { getSendMail } = require('../../app/services/send-mail');
const { countDatabaseRows } = require('../utils/db');
const { expectDatabaseCountsNotChanged, expectDatabaseCountsChangedBy } = require('./db');
const { expectNoMailSent, expectOneMailSent } = require('./mails');
const { isExpressApplication } = require('../utils/express');

/**
 * Loads the current state of the application for future comparison with the
 * `expectSideEffects` and `expectNoSideEffects` functions.
 *
 * @returns {Promise<InitialApplicationState>} The current state.
 */
exports.loadInitialState = async () => {
  return {
    initialDatabaseCounts: await countDatabaseRows()
  };
};

/**
 * Expects that no side effects have occurred. The goal of this function is to
 * ensure that no major changes happen unexpectedly as a result of a test, such
 * as inserted or deleted database rows that were not expected, or emails that
 * should not have been sent.
 *
 * Note: this assertion cannot detect the fact that a database row was inserted
 * and later deleted, or the reverse, unless the assertion is also made between
 * the insertion and deletion. It also cannot detect updates.
 *
 * @param {express.Express} app - The Express application under test.
 * @param {Object} options - Initial state and options.
 * @param {Object.<string, number>} [options.initialDatabaseCounts] - The
 * initial database row counts to use as a base for counting the number of
 * actual changes. If not specified, the database is assumed to contain nothing.
 * @returns {Promise<ApplicationSideEffects>} Detected side effects.
 */
exports.expectNoSideEffects = async (app, { initialDatabaseCounts, ...rest } = {}) => {
  if (!isExpressApplication(app)) {
    throw new Error('First argument must be an Express application');
  } else if (!isEmpty(rest)) {
    throw new Error(`Unknown no side effects options: ${JSON.stringify(rest)}`);
  }

  return exports.expectSideEffects(app, { initialDatabaseCounts });
};


/**
 * Expects that specified side effects have occurred. The goal of this function
 * is to ensure that no major changes happen unexpectedly as a result of a test,
 * such as inserted or deleted database rows that were not expected, or emails
 * that should not have been sent.
 *
 * Note: this assertion cannot detect the fact that a database row was inserted
 * and later deleted, or the reverse, unless the assertion is also made between
 * the insertion and deletion. It also cannot detect updates.
 *
 * @param {express.Express} app - The Express application under test.
 * @param {Object} options - Initial state and options.
 * @param {Object.<string, number>} [options.databaseChanges] - The expected
 * changes in database row counts. This is an object with table names as keys
 * and the expected changes as values. If not specified, no changes are expected
 * to have occurred.
 * @param {Object.<string, number>} [options.initialDatabaseCounts] - The
 * initial database row counts to use as a base for counting the number of
 * actual changes. If not specified, the database is assumed to contain nothing.
 * @param {Object} [options.mailSent] - An email that is expected to have been
 * sent. See the `expectOneMailSent` function.
 * @returns {Promise<ApplicationSideEffects>} Detected side effects.
 */
exports.expectSideEffects = async (app, { databaseChanges, initialDatabaseCounts, mailSent, ...rest } = {}) => {
  if (!isExpressApplication(app)) {
    throw new Error('First argument must be an Express application');
  } else if (!isEmpty(rest)) {
    throw new Error(`Unknown side effects options: ${JSON.stringify(rest)}`);
  }

  const result = {};

  if (databaseChanges) {
    await expectDatabaseCountsChangedBy(databaseChanges, initialDatabaseCounts);
  } else {
    await expectDatabaseCountsNotChanged(initialDatabaseCounts);
  }

  const sendMailMock = getSendMail(app);
  if (mailSent) {
    result.mail = expectOneMailSent(sendMailMock, mailSent);
  } else {
    expectNoMailSent(sendMailMock);
  }

  return result;
};

/**
 * @typedef {Object} InitialApplicationState
 * @property {Object.<string, number>} initialDatabaseCounts - The number of
 * rows in the database. This is an object with table names as keys and row
 * counts as values.
 */

/**
 * @typedef {Object} ApplicationSideEffects
 * @property {Object} [mail] - A mail that was sent (if there was one),
 * including its content (in the "html" property).
 */
