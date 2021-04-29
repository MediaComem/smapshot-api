const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;

const config = require('../../config');
const models = require('../models');
const { authenticationError } = require('../utils/errors');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwtSecret,
  passReqToCallback: true
};

// Middleware that checks whether the user is authenticated with a valid JWT
// bearer token.
module.exports = passport => {
  passport.use(new JwtStrategy(opts, async (req, jwtPayload, done) => {
    try {
      const user = await models.users.findOne({
        where: { id: jwtPayload.id }
      });

      if (!user) {
        return done(authenticationError(req.__('auth.error.generalServerAuth')));
      }

      done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
};
