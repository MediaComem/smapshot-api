const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./pose-estimation.controller");

const router = new express.Router();

// Compute the camera pose
router.post("/pose/compute",
  validateRequestBodyWithJsonSchema('ComputePoseRequest'),
  controller.computePoseCreateGltf
);

// (Re-)Compute the camera pose from values stored in the database.
router.get("/pose/recompute",
  authenticate(),
  authorize("super_admin"),
  validateDocumentedRequestParametersFor('GET', '/pose/recompute'),
  controller.computePoseCreateGltfFromDb
);

module.exports = router;
