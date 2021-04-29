const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./roles.controller.js");

const router = new express.Router();

// Promote a user by adding a role.
router.post("/users/:id/roles",
  authenticate(),
  authorize("super_admin", "owner_admin"),
  validateDocumentedRequestParametersFor('POST', '/users/{id}/roles'),
  validateRequestBodyWithJsonSchema('PromoteUserRequest'),
  controller.findUser,
  controller.promotion
);

// Demote a user by removing a role.
router.delete("/users/:id/roles",
  authenticate(),
  authorize("super_admin", "owner_admin"),
  validateDocumentedRequestParametersFor('DELETE', '/users/{id}/roles'),
  validateRequestBodyWithJsonSchema('DemoteUserRequest'),
  controller.findUser,
  controller.demotion
);

module.exports = router;
