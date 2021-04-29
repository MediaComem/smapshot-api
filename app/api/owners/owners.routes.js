const express = require("express");

const { authenticate } = require('../../utils/authorization');
const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./owners.controller");

const router = new express.Router();

// List owners.
router.get("/owners",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/owners'),
  controller.getList
);

module.exports = router;
