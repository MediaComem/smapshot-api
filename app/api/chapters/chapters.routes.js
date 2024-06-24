const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./chapters.controller");

const router = new express.Router();

// Get a chapter by id.
router.get("/stories/:storyId/chapters/:id",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/stories/{storyId}/chapters/{id}'),
  controller.getChapterById
);

router.post("/stories/:storyId/chapters",
  authenticate({ required: false }),
  authorize("owner_admin", "owner_validator"),
  validateRequestBodyWithJsonSchema('ChaptersRequest'),
  controller.addChapter
);

router.put("/stories/:storyId/chapters/:id",
  authenticate({ required: false }),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/stories/{storyId}/chapters/{id}'),
  controller.updateChapter
);

router.delete("/stories/:storyId/chapters/:id",
  authenticate({ required: false }),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('DELETE', '/stories/{storyId}/chapters/{id}'),
  controller.deleteChapter
);
module.exports = router;
