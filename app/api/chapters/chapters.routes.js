const express = require("express");

const { authenticate } = require('../../utils/authorization');
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./chapters.controller");

const router = new express.Router();

// get all of the chapters.
router.get("/chapters",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/chapters'),
  controller.getChapters
);

// Get a chapter by id.
router.get("/chapters/:id",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/chapters/{id}'),
  controller.getChapterById
);

router.post("/chapters",
  authenticate({ required: false }),
  validateRequestBodyWithJsonSchema('Chapters'),
  controller.addChapter
);

router.put("/chapters/:id",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('PUT', '/chapters/{id}'),
  controller.updateChapter
);

router.delete("/chapters/:id",
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('DELETE', '/chapters/{id}'),
  controller.deleteChapter
);
module.exports = router;
