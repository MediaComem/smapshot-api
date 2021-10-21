const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./problems.controller");
const listController = require("./problems.list.controller");

const router = new express.Router();

// List problems.
router.get("/problems",
  validateDocumentedRequestParametersFor('GET', '/problems'),
  listController.getList
);

// List problem types.
router.get("/problems/types",
  validateDocumentedRequestParametersFor('GET', '/problems/types'),
  listController.getTypes
);

// Update a problem's state.
router.put("/problems/:id/state",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/problems/{id}/state'),
  validateRequestBodyWithJsonSchema('UpdateProblemStateRequest'),
  controller.findProblem,
  controller.updateState
);

// Submit a problem concerning an image.
router.post("/problems",
  authenticate(),
  validateRequestBodyWithJsonSchema('CreateProblemRequest'),
  controller.submit
);

// Delete a problem.
router.delete("/problems/:id",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('DELETE', '/problems/{id}'),
  controller.findProblem,
  controller.delete
);

module.exports = router;
