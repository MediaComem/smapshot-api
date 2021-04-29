const LocalStrategy = require("passport-local").Strategy;

const models = require("../models");
const { authenticationError, unexpectedError } = require('../utils/errors');

module.exports = passport => {
  passport.use(
    "login",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true
      },
      async (req, email, password, done) => {
        try {
          const user = await models.users.findOne({ where: { email } });
          if (!user) {
            return done(authenticationError(req.__('auth.error.incorrectEmail')));
          } else if (!user.active) {
            return done(authenticationError(req.__('auth.error.accountNotActivated')));
          } else if (!(await user.validPassword(password))) {
            return done(authenticationError(req.__('auth.error.incorrectPassword')));
          }

          return done(null, user);
        } catch (err) {
          return done(unexpectedError(req.__('auth.error.generalServerAuth')));
        }
      }
    )
  );
};
