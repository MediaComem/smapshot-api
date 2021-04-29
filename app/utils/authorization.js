const { get } = require('lodash');
const passport = require('passport');

const { authenticationError, authorizationError } = require('./errors');
const { route } = require('./express');

/**
 * Middleware factory for JWT authentication.
 *
 * The JWT must be sent as a Bearer token in the Authorization header.
 *
 * @param {Object} [options] - Authentication options.
 * @param {boolean} [options.required=true] - Whether authentication is required (true) or optional (false).
 * When optional, authentication is still performed if the Authorization header is present, but
 * @returns An Express middleware function.
 */
exports.authenticate = (options = {}) => {
  const authenticationRequired = get(options, 'required', true);
  return (req, res, next) => passport.authenticate("jwt", (err, user) => {
    if (err) {
      // An authentication error occurred.
      next(err);
    } else if (user) {
      // The user was successfully authenticated.
      req.user = user;
      next();
    } else if (!user && !authenticationRequired && !req.get('Authorization')) {
      // No user was authenticated but authentication is optional and the
      // Authorization header was not sent.
      next();
    } else {
      // Authentication failed (e.g. the token is invalid or has expired).
      next(authenticationError(req.__('auth.error.generalServerAuth')));
    }
  })(req, res, next);
};

/**
 * Middleware factory for role-based permissions. Verifies that the user has at
 * least one of the specified roles.
 *
 *     router.get('/path',
 *       authenticate(),
 *       authorize('owner_admin', 'owner_validator');
 *       controller.operation
 *     );
 */
exports.authorize = (...authorizedRoles) => route((req, res, next) => {
  if (userIsAuthorized(req.user, authorizedRoles)) {
    // The user has one of the required roles, so continue on the next
    // middleware in the chain.
    next();
  } else {
    next(authorizationError(req.__('general.accessForbidden')));
  }
});

/**
 * Indicates whether the current user has a required role.
 *
 * @param {express.Request} req - The Express request object.
 * @param {string[]} roles - The role(s) to check.
 * @returns {boolean} True if a user is authenticated and that user has at least
 * one of the specified role or roles.
 */
exports.userHasRole = (req, ...roles) => userIsAuthorized(req.user, roles);

function userIsAuthorized(user, authorizedRoles) {
  if (!user) {
    return false;
  }

  return user.isSuperAdmin() || authorizedRoles.some(role => user.hasRole(role))
}
