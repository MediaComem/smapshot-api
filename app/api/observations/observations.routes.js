const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./observations.controller");
const listController = require("./observations.list.controller");

const router = new express.Router();

// List observations.
router.get("/observations",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/observations'),
  listController.getList
);

// Get the ranking of users.
router.get("/observations/ranking",
  validateDocumentedRequestParametersFor('GET', '/observations/ranking'),
  listController.getRanking
);

// Submit an observation.
router.post("/observations",
  authenticate({ required:false }),
  validateRequestBodyWithJsonSchema('CreateObservationRequest'),
  controller.submit
);

// Update an observation.
router.put("/observations/:id",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/observations/{id}'),
  validateRequestBodyWithJsonSchema('UpdateObservationRequest'),
  controller.findObservation,
  controller.update
);

// Validate or reject an observation.
router.put("/observations/:id/state",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/observations/{id}/state'),
  validateRequestBodyWithJsonSchema('UpdateObservationStateRequest'),
  controller.findObservation,
  controller.validateOrReject
);

// Delete an observation
router.delete("/observations/:id",
  authenticate(),
  authorize("volunteer", "owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('DELETE', '/observations/{id}'),
  controller.findObservation,
  controller.delete
);

module.exports = router;
