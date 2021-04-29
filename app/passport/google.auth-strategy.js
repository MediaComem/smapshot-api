const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

const config = require('../../config');
const models = require("../models");
const { getLogger } = require('../utils/express');

module.exports = passport => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleAuth.clientId,
        clientSecret: config.googleAuth.clientSecret,
        callbackURL: `${config.apiUrl}/auth/google/callback`,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          let first_name = "";
          let last_name = "";
          let email = "";
          if (profile.name) {
            first_name = profile.name.givenName;
            last_name = profile.name.familyName;
          }
          if (profile.emails) {
            email = profile.emails[0].value;
          }
          const user = await models.users.findOrCreate({
            where: { googleid: profile.id },
            defaults: {
              username: profile.displayName,
              email: email,
              first_name: first_name,
              last_name: last_name,
              lang: profile.locale || "en"
            }
          });
          /*
              findOrCreate returns an array containing the object that was found or created and a boolean that
              will be true if a new object was created
          */
          return done(null, user[0]);
        } catch (err) {
          getLogger(req).error(err);
          return done(null, false, {
            status: 401,
            errors: err.errors
          });
        }
      }
    )
  );
};
