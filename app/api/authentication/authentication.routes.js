const express = require("express");

const { validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./authentication.controller");

const router = new express.Router();

// Authenticate a local user account.
router.post("/auth/local/login",
  validateRequestBodyWithJsonSchema('LogInLocalUserRequest'),
  controller.login
);

// Register a new user account.
router.post("/auth/local/register",
  validateRequestBodyWithJsonSchema('RegisterLocalUserRequest'),
  controller.register
);

// Activate a user account.
router.post("/auth/local/activate",
  validateRequestBodyWithJsonSchema('ActivateLocalUserRequest'),
  controller.activate
);

// Authenticate a user with Google.
router.get("/auth/google", controller.saveClientCallBackURL, controller.google);
router.get("/auth/google/callback", controller.google);

// Authenticate a user with Facebook.
router.get("/auth/facebook", controller.saveClientCallBackURL, controller.facebook);
router.get("/auth/facebook/callback", controller.facebook);

// Request a link to reset a forgotten password.
router.post("/auth/forgot",
  validateRequestBodyWithJsonSchema('ForgottenPasswordRequest'),
  controller.forgot);

// Reset a user account's password (using the forgotten password link).
router.post("/auth/reset",
  validateRequestBodyWithJsonSchema('ResetPasswordRequest'),
  controller.reset);

module.exports = router;
