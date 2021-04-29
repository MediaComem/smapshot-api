const express = require("express");

const { authenticate } = require('../../utils/authorization');
const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./collections.controller");

const router = new express.Router();

// List collections.
router.get("/collections",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/collections'),
  controller.getList
);

// Get a collection.
router.get("/collections/:id",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/collections/{id}'),
  controller.getById
);

module.exports = router;
