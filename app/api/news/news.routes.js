const express = require("express");

const { authenticate } = require("../../utils/authorization");
const {
  validateDocumentedRequestParametersFor,
} = require("../../utils/validation");
const controller = require("./news.controller");

const router = new express.Router();

// List news.
router.get(
  "/news",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor("GET", "/news"),
  controller.getList
);

module.exports = router;
