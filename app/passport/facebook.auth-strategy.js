const FacebookStrategy = require("passport-facebook").Strategy;

const config = require('../../config');
const models = require("../models");
const { getLogger } = require('../utils/express');

module.exports = passport => {
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.facebookAuth.appId,
        clientSecret: config.facebookAuth.appSecret,
        callbackURL: `${config.apiUrl}/auth/facebook/callback`,
        profileFields: ["displayName", "email", "name"],
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
            where: { facebookid: profile.id },
            defaults: {
              username: profile.displayName,
              email: email,
              first_name: first_name,
              last_name: last_name,
              lang: req.getLocale() || "en"
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
            status: 500,
            message: req.__('auth.error.generalServerAuth')
          });
        }
      }
    )
  );
};
