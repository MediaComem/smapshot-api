const { hash } = require('bcrypt');
const jwt = require('jsonwebtoken');
const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { bcryptRounds, jwtSecret } = require('../../config');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation, uniqueGenerator } = require('../utils/fixtures');
const { locales } = require('./i18n');
const { createOwner } = require('./owners');

/**
 * Generates a random user email.
 *
 * @returns {string} A random email.
 */
exports.generateEmail = uniqueGenerator(() => chance.email({ domain: 'localhost.localdomain' }));

/**
 * Inserts a user into the database. Column values that are not provided will be
 * randomly generated or set to a default value.
 *
 * Setting `owner` to true will randomly generate an associated owner.
 *
 * @param {Object} [options] - Database column values for the user.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createUser = async (options = {}) => {

  const lang = getOrGenerate(options, 'lang', () => chance.pickone([ ...locales, null ]));
  const passwordHash = await hash(getOrGenerate(options, 'password', () => chance.word()), bcryptRounds);
  const roles = get(options, 'roles', [ 'volunteer' ]);
  const { owner, owner_id } = await getOrGenerateAssociation(options, createOwner, {
    association: 'owner',
    required: roles.includes('owner_validator') || roles.includes('owner_admin')
  });

  const columns = {
    lang,
    owner_id,
    first_name: getOrGenerate(options, 'first_name', () => chance.first()),
    last_name: getOrGenerate(options, 'last_name', () => chance.last()),
    password: passwordHash,
    email: getOrGenerate(options, 'email', exports.generateEmail),
    username: getOrGenerate(options, 'username', () => chance.word()),
    googleid: get(options, 'googleid', null),
    facebookid: get(options, 'facebookid', null),
    letter: get(options, 'letter', false),
    nimages: get(options, 'nimages', 0),
    date_registr: getOrGenerate(options, 'date_registr', () => new Date()),
    has_one_validated: get(options, 'has_one_validated', false),
    reset_password_token: get(options, 'reset_password_token', null),
    reset_password_expires: get(options, 'reset_password_expires', null),
    roles: roles,
    active: get(options, 'active', true),
    active_token: get(options, 'active_token', null),
    active_expires: get(options, 'active_expires', null)
  };

  const result = await sequelize.query(
    `
      INSERT INTO users
      (
        first_name, last_name, password, email, username, googleid,
        facebookid, letter, nimages, date_registr, lang,
        has_one_validated, reset_password_token, reset_password_expires,
        roles, owner_id, active, active_token, active_expires
      )
      VALUES (
        :first_name, :last_name, :password, :email, :username, :googleid,
        :facebookid, :letter, :nimages, :date_registr, :lang,
        :has_one_validated, :reset_password_token, :reset_password_expires,
        array[:roles]::text[], :owner_id, :active, :active_token, :active_expires
      )
      RETURNING id
    `,
    {
      replacements: columns,
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedUser = rows[0];

  return {
    ...columns,
    owner,
    id: insertedUser.id
  };
};

/**
 * Generates a valid JSON web token for the specified user.
 *
 * @param {Object} user - The user to generate a JWT for.
 * @param {Object} options - JWT options (ex: expiresIn).
 * @returns {string} The generated JWT.
 */
exports.generateJwtFor = async (user, options = {}) => new Promise((resolve, reject) => {
  jwt.sign({ id: user.id }, jwtSecret, options, (err, token) => err ? reject(err) : resolve(token));
});
