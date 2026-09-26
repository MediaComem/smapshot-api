const express = require("express");

const { authenticate, authorize } = require("../../utils/authorization");
const { validateDocumentedRequestParametersFor, validateRequestBodyWithJsonSchema } = require('../../utils/validation');
const controller = require("./locations.controller");

const router = new express.Router();

// Get the country code of a set of coordinates in ISO 3166-2 alpha-2 format.
router.get("/locations/:longitude,:latitude/countrycode",
  validateDocumentedRequestParametersFor('GET', '/locations/{longitude},{latitude}/countrycode'),
  controller.getCountryCode
);

// Get the apriori locations of a collection's non-validated images.
router.get("/locations/:collectionId/apriori_locations",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('GET', '/locations/{collectionId}/apriori_locations'),
  controller.getAprioriLocationsByCollection
);

// Get the apriori locations of a non-validated image.
router.get("/locations/images/:imageId/apriori_locations",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('GET', '/locations/images/{imageId}/apriori_locations'),
  controller.getAprioriLocationsByImage
);

// Replace the apriori locations of an image with a new, exact one.
router.put("/locations/images/:imageId/exact-location",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('PUT', '/locations/images/{imageId}/exact-location'),
  validateRequestBodyWithJsonSchema('UpdateExactLocationRequest'),
  controller.updateExactLocation
);

// Delete an apriori location.
router.delete("/locations/apriori_locations/:aprioriLocationId",
  authenticate(),
  authorize("owner_admin", "owner_validator"),
  validateDocumentedRequestParametersFor('DELETE', '/locations/apriori_locations/{aprioriLocationId}'),
  controller.deleteAprioriLocation
);

module.exports = router;
