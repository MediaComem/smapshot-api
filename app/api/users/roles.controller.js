const models = require("../../models");
const { route } = require("../../utils/express");
const { inUniqueOrList } = require("../../utils/params");
const { notFoundError, authorizationError, requestBodyValidationError } = require("../../utils/errors");
const { getOwnerScope } = require('./users.utils');

const Sequelize = require("sequelize");
const Op = Sequelize.Op;

const rolesOwnersCanAdd  = ["owner_validator", "volunteer"];
const rolesOwnersCanRemove = ["owner_validator"];

exports.promotion = route(async (req, res) => {
  const admin_roles = req.user.roles;
  const owner_id = req.body.owner_id;
  const new_role = req.body.role;

  if (req.queryUser.roles.includes(new_role)) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '/role',
        message: req.__('roles.user.containsRole'),
        validation: 'rolesUserContainsRole'
      }
    ])
  }

  if (new_role === "owner_admin" || new_role === "owner_validator") {
    if (!owner_id) {
      throw requestBodyValidationError(req, [
        {
          location: 'body',
          path: '',
          message: req.__('roles.owner.errorIdRequired'),
          validation: 'rolesOwnerIdRequired'
        }
      ])  
    }
  }

  // An owner admin is allowed to add only 'owner_validator' or 'volunteer'
  if (
    !admin_roles.includes("super_admin") &&
    admin_roles.includes("owner_admin") &&
    !rolesOwnersCanAdd.includes(new_role)
  ) {
    throw authorizationError(req.__('general.accessForbidden'));
  }

  // Add filter by IDs
  const whereUser = inUniqueOrList(req.queryUser.id);

  await models.users.update(
    {
      roles: models.sequelize.fn("array_append", models.sequelize.col("roles"), new_role),
      owner_id: owner_id
    },
    {
      where: {
        id: whereUser,
        [Op.not]: {
          roles: {
            [Op.contains]: [new_role]
          }
        }
      }
    }
  );

  res.status(200).send({ message: req.__("User was promoted.") });
});

exports.demotion = route(async (req, res) => {
  const admin_roles = req.user.roles;
  const role_to_remove = req.body.role;

  if (!req.queryUser.roles.includes(role_to_remove)) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '/role',
        message: req.__('roles.user.doesNotExist'),
        validation: 'rolesUserDoesNotExist'
      }
    ])
  }

  // An owner admin is allowed to delete only 'owner_validator'
  if (
    !admin_roles.includes("super_admin") &&
    admin_roles.includes("owner_admin") &&
    !rolesOwnersCanRemove.includes(role_to_remove)
  ) {
    throw authorizationError(req.__('general.accessForbidden'));
  }
  // Add filter by IDs
  const whereUser = inUniqueOrList(req.queryUser.id);

  await models.users.update(
    {
      roles: models.sequelize.fn(
        "array_remove",
        models.sequelize.col("roles"),
        role_to_remove
      )
    },
    {
      where: {
        id: whereUser,
        roles: {
          [Op.contains]: [role_to_remove]
        }
      }
    }
  );

  res.status(200).send({ message: req.__("User's role was removed.") });
});

// Utility functions & middlewares
// ===============================

exports.findUser = route(async (req, res, next) => {
  const isSuperUser = req.user.isSuperAdmin();
  const { include } = getOwnerScope(req);
  let whereUser = {};

  if (!isSuperUser) {
    whereUser = {
      id: req.params.id,
      owner_id: include.owner_id,
    }
  } else {
    whereUser = {
      id: req.params.id,
    }
  }

  const queryUser = await models.users.findOne({
    where: whereUser
  });

  if (!queryUser) {
    throw notFoundError(req);
  }
  req.queryUser = queryUser;
  next();
});
