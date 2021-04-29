const express = require("express");

const { authenticate } = require('../../utils/authorization');
const { validateDocumentedRequestParametersFor } = require('../../utils/validation');
const controller = require("./owner.images.controller");

module.exports = () => {
  const router = new express.Router();

  // Get the attributes of an image identified by its original ID.
  router.get("/owners/:owner_id_slug/original_images/:original_id/attributes",
    authenticate({ required: false }),
    validateDocumentedRequestParametersFor('GET', '/owners/{owner_id_slug}/original_images/{original_id}/attributes'),
    controller.getAttributes
  );

  return router;
};
