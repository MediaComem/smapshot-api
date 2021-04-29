const express = require("express");

const { authenticate } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./me.controller");

const router = new express.Router();

// Retrieve profile info from the logged in user.
router.get("/me/info",
  authenticate(),
  controller.getInfo
);

// List geolocations of the logged in user.
router.get("/me/geolocalisations",
  authenticate(),
  validateDocumentedRequestParametersFor('GET', '/me/geolocalisations'),
  controller.getGeolocalisations
);

// List observations of the logged in user.
router.get("/me/observations",
  authenticate(),
  validateDocumentedRequestParametersFor('GET', '/me/observations'),
  controller.getObservations
);

// List corrections of the logged in user.
router.get("/me/corrections",
  authenticate(),
  validateDocumentedRequestParametersFor('GET', '/me/corrections'),
  controller.getCorrections
);

// Update logged in user profile.
router.put("/me/info",
  authenticate(),
  validateRequestBodyWithJsonSchema('UpdateUserInfoRequest'),
  controller.updateInfo
);

// Update logged in user password.
router.put("/me/password",
  authenticate(),
  validateRequestBodyWithJsonSchema('UpdateUserPasswordRequest'),
  controller.updatePwd
);

module.exports = router;
