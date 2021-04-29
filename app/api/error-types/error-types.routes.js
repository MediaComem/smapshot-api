const express = require("express");

const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./error-types.controller");

const router = new express.Router();

router.get("/errors/types",
  validateDocumentedRequestParametersFor('GET', '/errors/types'),
  controller.getList
);

module.exports = router;
