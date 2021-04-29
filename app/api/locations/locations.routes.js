const express = require("express");

const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./locations.controller");

const router = new express.Router();

// Get the country code of a set of coordinates in ISO 3166-2 alpha-2 format.
router.get("/locations/:longitude,:latitude/countrycode",
  validateDocumentedRequestParametersFor('GET', '/locations/{longitude},{latitude}/countrycode'),
  controller.getCountryCode
);

module.exports = router;
