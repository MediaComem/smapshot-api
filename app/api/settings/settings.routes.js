const express = require("express");

const { validateDocumentedRequestParametersFor } = require("../../utils/validation");
const controller = require("./settings.controller");

const router = new express.Router();

// Get a setting's value by name.
router.get(
  "/settings/:name",
  validateDocumentedRequestParametersFor("GET", "/settings/{name}"),
  controller.getByName
);

module.exports = router;
