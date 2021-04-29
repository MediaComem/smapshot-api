const express = require('express');
const docs = require('./docs.controller.js');

const router = new express.Router();

router.use('/docs', docs.serveOpenApiDocs);
router.get('/openapi.json', docs.serveOpenApiDocument);

module.exports = router;
