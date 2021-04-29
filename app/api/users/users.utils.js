/**
 * Returns the query scope that represents the users that are owned by the same
 * owner as the authenticated user's (or all users for super administrators).
 * The user must be an owner administrator or a super administrator.
 *
 * @param {express.Request} req - The Express request object.
 * @returns {Object} Where clauses for a sequelize query.
 */
exports.getOwnerScope = req => {
  const include = {};

  const user = req.user;
  if (user.hasRole('owner_admin')) {
    const owner_id = user.owner_id;
    if (!owner_id) {
      throw new Error(`Owner administrator ${user.id} has no owner ID`);
    }

    // An owner administrator can only access user linked to the
    // same owner.
    include.owner_id = owner_id;
  } else if (!user.isSuperAdmin()) {
    // A super administrator can access all users. Any other user should not
    // reach this point.
    throw new Error(`Cannot determine owner scope for user ${user.id} with unsupported role(s) ${user.roles.join(', ')}`);
  }
  return { include };
};
