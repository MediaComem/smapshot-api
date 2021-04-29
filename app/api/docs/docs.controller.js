const swagger = require('swagger-ui-express');
const { openApiDocument } = require('../../utils/openapi');

exports.serveOpenApiDocs = [ swagger.serve, swagger.setup(openApiDocument) ];

exports.serveOpenApiDocument = (req, res) => res.set('Content-Type', 'application/vnd.oai.openapi+json').send(openApiDocument);
