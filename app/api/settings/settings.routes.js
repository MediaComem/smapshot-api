const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor } = require("../../utils/validation");
const controller = require("./settings.controller");

const router = new express.Router();

// Get a setting's value by name.
router.get(
  "/settings/:name",
  validateDocumentedRequestParametersFor("GET", "/settings/{name}"),
  controller.findSetting,
  controller.getByName
);

// Update a setting's value by name.
router.put(
  "/settings/:name",
  authenticate(),
  authorize("super_admin"),
  validateDocumentedRequestParametersFor("PUT", "/settings/{name}"),
  controller.findSetting,
  controller.update
);

module.exports = router;
