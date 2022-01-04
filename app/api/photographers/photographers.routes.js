const express = require("express");

const { authenticate, authorize } = require('../../utils/authorization');
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./photographers.controller");

const router = new express.Router();

// List photographers.
router.get("/photographers",
  authenticate({ required: true }),
  authorize("owner_admin", "super_admin"),
  validateDocumentedRequestParametersFor('GET', '/photographers'),
  controller.getList
);

// Post photographers.
router.post("/photographers",
  authenticate({ required: true }),
  authorize("owner_admin"),
  validateRequestBodyWithJsonSchema('PostPhotographerRequest'),
  controller.postPhotographers
);

module.exports = router;
