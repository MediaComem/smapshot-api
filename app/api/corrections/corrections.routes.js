const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./corrections.controller");
const listController = require("./corrections.list.controller");

const router = new express.Router();

// List corrections.
router.get("/corrections",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('GET', '/corrections'),
  listController.getList
);

// Get the ranking of users.
router.get("/corrections/ranking",
  validateDocumentedRequestParametersFor('GET', '/corrections/ranking'),
  listController.getRanking
);

// Submit a title or caption correction.
router.post("/corrections",
  authenticate(),
  validateRequestBodyWithJsonSchema('CreateCorrectionRequest'),
  controller.submit
);

// Submit a modification of a correction as a validator (the new correction is
// automatically accepted).
router.put("/corrections/:id",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/corrections/{id}'),
  validateRequestBodyWithJsonSchema('UpdateCorrectionRequest'),
  controller.findCorrection,
  controller.update
);

// Validate or reject a correction.
router.put("/corrections/:id/state",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/corrections/{id}/state'),
  validateRequestBodyWithJsonSchema('UpdateCorrectionStateRequest'),
  controller.findCorrection,
  controller.updateState
);

module.exports = router;
