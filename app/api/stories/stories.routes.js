const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./stories.controller");

const router = new express.Router();

// Route to get all stories
router.get('/stories', 
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/stories'),
  controller.getStories
);

// Route to get a story by ID
router.get('/stories/:id', 
  authenticate({ required: false }),
  validateDocumentedRequestParametersFor('GET', '/stories/{id}'),
  controller.getStoryById 
);

// Route to add a new story
router.post('/stories', 
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateRequestBodyWithJsonSchema('Stories'),
  controller.addStory
);

// Route to update a story
router.put('/stories/:id', 
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/stories/{id}'),
  controller.updateStory
);

// Route to delete a story
router.delete('/stories/:id', 
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('DELETE', '/stories/{id}'),
  controller.deleteStory
);
module.exports = router;

