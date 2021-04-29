const express = require("express");

const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./stats.controller.js");

const router = new express.Router();

// Get global statistics.
router.get("/stats",
  validateDocumentedRequestParametersFor('GET', '/stats'),
  controller.count
);

module.exports = router;
