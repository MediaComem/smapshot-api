const { get, pick } = require('lodash');
const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { expect } = require('../utils/chai');
const { compactObject } = require('../utils/fixtures');

/**
 * Checks that the specified user is in the database and matches the expected
 * data.
 *
 * @param {Object} expected - An object representing the expected values of all
 * database columns for the user.
 * @returns {Object} The matching database row.
 */
exports.expectUserInDatabase = async expected => {

  const row = await findUserDatabaseRow(expected);

  expect(row).to.matchObject({
    id: row.id,
    first_name: get(expected, 'first_name', null),
    last_name: get(expected, 'last_name', null),
    password: get(expected, 'password', null),
    email: get(expected, 'email', null),
    username: get(expected, 'username', null),
    googleid: get(expected, 'googleid', null),
    facebookid: get(expected, 'facebookid', null),
    letter: get(expected, 'letter', false),
    nimages: get(expected, 'nimages', null),
    date_registr: expected.date_registr,
    lang: get(expected, 'lang', null),
    has_one_validated: get(expected, 'has_one_validated', false),
    reset_password_token: get(expected, 'reset_password_token', null),
    reset_password_expires: get(expected, 'reset_password_expires', null),
    roles: get(expected, 'roles', []),
    owner_id: get(expected, 'owner_id', null),
    active: get(expected, 'active', false),
    active_token: get(expected, 'active_token', null),
    active_expires: get(expected, 'active_expires', null),
    last_login: get(expected, 'last_login', null)
  });

  return row;
};

/**
 * Returns the expected user JSON from the API for a given database row.
 *
 * @param {Object} user - The user database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @param {(boolean|number)} [options.date_registr] - The expected date_registr, or
 * true to automatically expect the user registration_date, or false
 * to expect no registration date.
 * @returns {Object} The expected API user.
 */
exports.getExpectedUser = (user, options = {}) => {
  const {
    date_registr: expectedDateRegistration,
    ...extraProperties
  } = options;

  const expected =  {
    ...extraProperties,
    ...pick(user, 'id', 'first_name', 'last_name', 'email', 'username', 'letter', 'lang', 'has_one_validated', 'roles', 'owner_id')
  };

  if (expectedDateRegistration === true || expectedDateRegistration === undefined) {
    expected.date_registr = user.date_registr ? user.date_registr.toISOString() : null;
  }

  return compactObject(expected);

};

async function findUserDatabaseRow(expected) {
  const id = expected.id;
  const active_token = expected.active_token;
  if (id) {
    const result = await sequelize.query(
      `SELECT * FROM users where id = :id`,
      {
        replacements: { id },
        type: QueryTypes.SELECT
      }
    );
    expect(result, `database users with id ${id}`).to.have.lengthOf(1);
    return result[0];
  }
  else if (active_token) {
    const result = await sequelize.query(
      `SELECT * FROM users where active_token = :active_token`,
      {
        replacements: { active_token },
        type: QueryTypes.SELECT
      }
    );
    expect(result, `database users with active_token ${active_token}`).to.have.lengthOf(1);
    return result[0];
  }

  throw new Error(`Finding a user in the database requires either an id or an an active token for newly registered user:\n\n${JSON.stringify(expected, undefined, 2)}`);
}
