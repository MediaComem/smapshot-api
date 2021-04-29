const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./geolocalisations.controller");
const listController = require("./geolocalisations.list.controller");

const router = new express.Router();

// List geolocalisations.
router.get("/geolocalisations",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('GET', '/geolocalisations'),
  listController.getList
);

// Get the ranking of users.
router.get("/geolocalisations/ranking",
  validateDocumentedRequestParametersFor('GET', '/geolocalisations/ranking'),
  listController.getRanking
);

// Get a geolocalisation.
router.get("/geolocalisations/:id",
  validateDocumentedRequestParametersFor('GET', '/geolocalisations/{id}'),
  controller.getAttributes
);

// A user or a validator starts a new geolocalisation.
router.post("/geolocalisations/",
  authenticate({required:false}),
  validateRequestBodyWithJsonSchema('CreateGeolocalisationRequest'),
  controller.start
);

// The geolocalisation is completed and validator will be notified for a check.
// If validationMode is true, the geolocalisation is an improvement made by a
// validator.
router.put("/geolocalisations/:id/save",
  authenticate({required:false}),
  validateDocumentedRequestParametersFor('PUT', '/geolocalisations/{id}/save'),
  validateRequestBodyWithJsonSchema('SaveGeolocalisationRequest'),
  controller.save
);

// Validate or reject the geolocalisation.
router.put("/geolocalisations/:id/state",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/geolocalisations/{id}/state'),
  validateRequestBodyWithJsonSchema('UpdateGeolocalisationStateRequest'),
  controller.findGeolocalisation,
  controller.validateOrReject
);

// Save the footprint in the database.
router.post("/geolocalisations/:id/footprint",
  validateDocumentedRequestParametersFor('POST', '/geolocalisations/{id}/footprint'),
  validateRequestBodyWithJsonSchema('UpdateGeolocalisationFootprintRequest'),
  controller.saveFootprint
);

module.exports = router;
