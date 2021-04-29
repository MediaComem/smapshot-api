const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./users.controller.js");

const router = new express.Router();

router.get("/users",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('GET', '/users'),
  controller.getList
);

router.get("/users/ranking",
  validateDocumentedRequestParametersFor('GET', '/users/ranking'),
  controller.getRanking
);

module.exports = router;
