/* eslint-disable node/no-unpublished-require */
const chalk = require('chalk');
const jwt = require('jsonwebtoken');
const { get } = require('lodash');

const { jwtSecret } = require('../config');
const { devUserPassword } = require('../config/dev');
const logger = require('../config/logger');
const models = require('../app/models');
const { env } = require('../config');

if (env !== 'development') {
  throw new Error(`This script can only be run in the development environment (the current environment is ${JSON.stringify(env)})`);
}

const devDomain = 'smapshot.heig-vd.ch';
const roles = [ 'volunteer', 'super_admin', 'owner_admin', 'owner_validator' ];

Promise.resolve().then(populate).then(disconnectFromDatabase).catch(err => {
  console.error(chalk.red(err.stack));
});

async function populate() {

  const owners = await models.owners.findAll({ order: [ 'slug' ] });
  logger.info(`${owners.length} owners found in the database, creating development users...`);

  const results = await Promise.all(roles.map(role => createOrUpdateDevUsersForRole(role, owners)));
  for (const { user, created, token } of results.flat()) {
    const email = user.email;
    logger.info(`${chalk.green(email)} ${created ? 'created' : 'updated'}, API token: ${chalk.cyan(token)}`);
  }

  logger.info(`The password of development users is defined by the ${chalk.green('$DEV_USER_PASSWORD')} environment variable (see your .env file)`);
}

async function createOrUpdateDevUsersForRole(role, owners) {
  // If the role is an owner role, create a user for each owner in the database,
  // with a username that contains the slug of the owner to differentiate them.
  if (isOwnerRole(role)) {
    return Promise.all(owners.map(owner => createOrUpdateDevUser({
      role,
      owner_id: owner.id,
      username: getOwnerDevUserName(role, owner)
    })));
  }

  // Otherwise just create a basic user.
  return createOrUpdateDevUser({
    role,
    username: getSimpleDevUserName(role)
  });
}

async function createOrUpdateDevUser(options = {}) {
  const { owner_id, role, username } = options;
  const email = get(options, 'email', `${username}@${devDomain}`);

  let created = false;
  let user = await models.users.findOne({
    where: { email }
  });

  if (!user) {
    created = true;
    user = await models.users.create({
      email,
      username,
      owner_id,
      first_name: 'Devel',
      last_name: 'Opment',
      password: devUserPassword,
      roles: [ role ],
      active: true
    });
  } else {
    user.username = username;
    user.owner_id = owner_id;
    user.first_name = 'Devel';
    user.last_name = 'Opment';
    user.password = devUserPassword;
    user.roles = [ role ];
    user.active = true;
    user.active_token = null;
    user.active_expires = null;
    user.reset_password_token = null;
    user.reset_password_expires = null;
    await user.save();
  }

  return {
    user,
    created,
    token: await generateJwtFor(user)
  };
}

async function disconnectFromDatabase() {
  await models.sequelize.close();
}

function generateJwtFor(user) {
  return new Promise((resolve, reject) => {
    return jwt.sign({ id: user.id }, jwtSecret, (err, token) => err ? reject(err) : resolve(token));
  });
}

function getOwnerDevUserName(role, owner) {
  return `${getSimpleDevUserName(role)}-${owner.slug}`;
}

function getSimpleDevUserName(role) {
  return `dev-${role.replace(/_/g, '-')}`;
}

function isOwnerRole(role) {
  return role.startsWith('owner_');
}
