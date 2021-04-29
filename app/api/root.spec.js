const { expect } = require('../../spec/utils/chai');
const { dereferencedOpenApiDocument } = require('../utils/openapi');
const { createApplicationWithMocks } = require('../../spec/utils/mocks');
const request = require('supertest');

// Run a few checks on the OpenAPI document itself.
describe('API root', () => {
  let app;
  it('indicates the correct version', async () => {
    ({ app } = createApplicationWithMocks());

    const res = await request(app).get('/');
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ version: dereferencedOpenApiDocument.info.version });
  });
});
