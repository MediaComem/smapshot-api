const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./gltf.controller");

const router = new express.Router();

// (Re-)create a GLTF file from the orientation stored in the database.
router.get("/gltf/regenerate",
  authenticate(),
  authorize("super_admin"),
  validateDocumentedRequestParametersFor('GET', '/gltf/regenerate'),
  controller.generateFromDbPose
);

router.post("/gltf/:id/save",   
  validateDocumentedRequestParametersFor('POST', '/gltf/{id}/save'),
  controller.saveGltf
);

router.delete("/gltf/:id",
  validateDocumentedRequestParametersFor('DELETE', '/gltf/{id}'),
  controller.deleteTempGltf
);

module.exports = router;
