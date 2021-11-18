const crypto = require("crypto-promise");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const config = require('../../../config');
const models = require("../../models");
const { sendMail } = require('../../services/send-mail');
const { requestBodyValidationError, uniqueConstraintError, isSequelizeUniqueConstraintErrorForColumn } = require('../../utils/errors');
const { createApiError, getLogger, route } = require("../../utils/express");

exports.login = [
  passportLocalAuthenticationMiddleware,
  route(async (req, res) => {
    const user = req.user;
    const token = await generateJwtFor(user);
    getLogger(req).verbose(`User ${user.id} has successfully logged in`);
    storeLastLoginDate(user)

    res.send({
      user: {
        email: user.email,
        username: user.username
      },
      token
    });
  })
];

exports.register = [
  registrationHoneypotMiddleware,
  route(async (req, res) => {
    validateReturnUrl(req, 'return_url');
    const user = await createLocalUserAccount(req);
    await generateAndSetActivationTokenFor(user);
    await sendRegistrationConfirmationEmail(user, req);

    res.status(201).send({
      message: req.__('auth.createAccount.success')
    });
  })
];

exports.activate = route(async (req, res) => {
  const user = await models.users.findOne({
    attributes: ["id", "active", "active_expires"],
    where: {
      active_token: req.body.token,
    }
  });

  if (!user || (Date.now() >= user.active_expires)) {
    getLogger(req).warn("User activation: Invalid token or token has expired");
    throw createApiError(
      req.__('auth.error.linkNotValid'),
      {
        status: 400
      }
    );
  }

  if (user.active){
    getLogger(req).warn("User account has already been activated");
    throw createApiError(
      req.__('auth.error.alreadyActivated'),
      {
        status: 400
      }
    );
  }

  user.active = true;

  await user.save();

  return res.status(200).send({
    message: req.__('auth.activateAccount.success')
  });
});

exports.saveClientCallBackURL = (req, res, next) => {
  req.session.return_url = decodeURIComponent(req.query.return_url);

  next();
};

exports.google = (req, res, next) => {
  passport.authenticate(
    "google",
    {
      session:false,
      scope: ["email", "profile"]
    },
    (error, user, info) => {
      if (error || !user)
        return res.redirect(`${req.session.return_url}?error_status=${info.status || 401}&error_message=${encodeURIComponent(info.errors[0].message)}`);

      req.login(user, { session: false }, err => {
        if (err) return res.status(400).send(err);

        storeLastLoginDate(user)
        const token = jwt.sign({ id: user.id }, config.jwtSecret);
        // redirect to front-end to receive the token
        res.redirect(`${req.session.return_url}?token=${token}`);
        delete req.session.return_url;
      });
      return next();
    }
  )(req, res, next);
};

exports.facebook = (req, res, next) => {
  passport.authenticate(
    "facebook",
    {
      session: false,
      scope: ["email"]
    },
    (error, user, info) => {
      if (error || !user)
        return res.status(info.status || 401).send({ message: info.message });

      req.login(user, { session: false }, err => {
        if (err) return res.status(400).send(err);

        storeLastLoginDate(user)
        const token = jwt.sign({ id: user.id }, config.jwtSecret);
        // redirect to front-end to receive the token
        res.redirect(`${req.session.return_url}?token=${token}`);
        delete req.session.return_url;
      });

      return next();
    }
  )(req, res, next);
};

exports.forgot = route(async (req, res) => {
  validateReturnUrl(req, 'return_url');

  const randomBytes = await crypto.randomBytes(20);
  const token = randomBytes.toString("hex");
  // It could be done with new URL and searchParams, but there are a issues with
  // hash mode and query params in vue router for example and others frameworks.
  const return_url = req.body.return_url + '?token=' + token

  const user = await models.users.findOne({
    attributes: ["id", "username", "email", "googleid", "facebookid"],
    where: {
      email: req.body.email
    }
  });

  if (!user) {
    throw createApiError(
      req.__('auth.error.noAccountExist'),
      {
        status: 400
      }
    );
  }

  if (user.facebookid != null || user.googleid != null){
    throw createApiError(
      req.__('auth.error.noPasswordChangeWithSocialEmail'),
      {
        status: 400
      }
    );
  }

  user.reset_password_token = token;
  user.reset_password_expires = Date.now() + 3600000; // 1 hour

  await user.save();

  const mailOptions = {
    to: user.email,
    from: config.smtp.from,
    subject: "Smapshot: " + req.__('auth.resetPassword.emailTitle'),
    html: req.__('auth.resetPassword.emailDescription', { url: return_url })
  };

  await sendMail(req.app, mailOptions);

  getLogger(req).info("An e-mail has been sent to " + user.email + " with further instructions.");

  return res.status(200).send({
    message: req.__('auth.forgotPassword.success')
  });
});

exports.reset = route(async (req, res) => {
  const user = await models.users.findOne({
    attributes: ["id", "username", "email", "password", "reset_password_expires"],
    where: {
      reset_password_token: req.body.token,
    }
  });

  if (!user || (Date.now() >= user.reset_password_expires)) {
    getLogger(req).warn("Reset password: Invalid token or token has expired");
    throw createApiError(
      req.__('auth.error.linkNotValid'),
      {
        status: 400
      }
    );
  }

  user.password = req.body.password;

  // Change token to make it unavailable when already used
  const randomBytes = await crypto.randomBytes(20);
  const random_token = randomBytes.toString("hex");

  user.reset_password_token = random_token;

  await user.save();

  return res.status(200).send({
    message: req.__('auth.resetPassword.success')
  });
});

function passportLocalAuthenticationMiddleware(req, res, next) {
  passport.authenticate("login", { session: false }, (err, user, _info) => {
    if (err) {
      return next(err);
    } else if (!user) {
      return next(new Error('User not available after login'));
    }

    req.user = user;
    next();
  })(req, res, next);
}

function registrationHoneypotMiddleware(req, res, next) {
  if (req.body.firstname && req.body.firstname !== ''){
    return res.send({
      message: req.__('auth.createAccount.success')
    });
  }

  next();
}

async function createLocalUserAccount(req) {

  const { email, letter, password, username } = req.body;
  const { lang } = req.query;

  try {
    const user = await models.users.create({
      username,
      email,
      password,
      lang,
      letter: letter || false
    });

    getLogger(req).info(`User ${user.id} has registered with username ${username} and email ${email}`);

    return user;
  } catch (err) {

    // Send a specific error message if the email already exists.
    if (isSequelizeUniqueConstraintErrorForColumn(err, 'email')) {
      throw uniqueConstraintError(req.__('auth.error.emailAlreadyExists'), err);
    }

    throw err;
  }
}

function generateJwtFor(user) {
  return new Promise((resolve, reject) => {
    jwt.sign({ id: user.id }, config.jwtSecret, (err, token) => err ? reject(err) : resolve(token));
  });
}

async function generateAndSetActivationTokenFor(user) {
  const randomBytes = await crypto.randomBytes(20);
  const token = randomBytes.toString('hex');
  const tokenExpiration = Date.now() + (3600000 * 24 * 3) // 72 hours;

  await models.users.update({
      active_token: token,
      active_expires: tokenExpiration
    }, {
    where: {
      id: user.id
    }
  });

  user.active_token = token;
  user.active_expires = tokenExpiration;
}

async function storeLastLoginDate(user) {
  const lastLogin = Date.now();
  await models.users.update({
    last_login: lastLogin
  }, {
    where: {
      id: user.id
    }
  });
  user.last_login = lastLogin;
}

async function sendRegistrationConfirmationEmail(user, req) {
  // It could be done with new URL and searchParams, but there are a issues with
  // hash mode and query params in vue router for example and others frameworks.
  //
  // Suggested improvement: have the frontend send a URI template
  // (https://tools.ietf.org/html/rfc6570) that this API can inject the token
  // into without knowing the format in advance.
  const returnUrl = req.body.return_url + '?token=' + user.active_token;

  const mailOptions = {
    to: user.email,
    from: config.smtp.from,
    subject: `Smapshot: ${req.__('auth.confirmAccount.emailTitle')}`,
    html: req.__('auth.confirmAccount.emailDescription', { url: returnUrl })
  };

  await sendMail(req.app, mailOptions);

  getLogger(req).info(`A confirmation e-mail has been sent to ${user.email} with further instructions.`);
}

function validateReturnUrl(req, bodyProperty) {
  const returnUrl = req.body[bodyProperty];
  if (!config.returnUrls.some(allowedReturnUrl => returnUrl.startsWith(allowedReturnUrl))) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: `/${bodyProperty}`,
        message: 'Return URL is not allowed',
        validation: 'forbiddenReturnUrl'
      }
    ]);
  }
}
