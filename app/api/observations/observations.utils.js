const models = require('../../models');

const { getOwnerScope: getImageOwnerScope } = require('../images/images.utils');

/**
 * Returns the query scope that represents observations accessible by the
 * authenticated user. The user must be either an owner administrator or an
 * owner validator, or a super administrator.
 *
 * @param {express.Request} req - The Express request object.
 * @returns {Object} Includes clauses for a sequelize query.
 */
exports.getOwnerScope = req => {
  const include = [];
  const where = {};

  const user = req.user;
  if (user.hasRole('owner_admin') || user.hasRole('owner_validator')) {
    // An owner administrator or validator can only access observations on
    // images linked to the same owner.
    const { where } = getImageOwnerScope(req);
    include.push({
      model: models.images,
      attributes: [],
      where
    });
  } else if (!user.isSuperAdmin()) {
    // scope volunteers to see only their own observations
    where.user_id = user.id;
  }

  return { include, where };
};
