const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { createOwner } = require('../../../spec/fixtures/owners');
const { generate } = require('../../../spec/utils/fixtures');
const { getExpectedOwner } = require('../../../spec/expectations/owners');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Add new story', async () => {
    const [ owner1 ] = await generate(1, createOwner);
    const req = {
      method: 'POST',
      path: '/stories',
      body: {
        title: "My story",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: owner1.id
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(201)
    .and.to.have.jsonBody({
      id: 1,
      title: "My story",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg",
      owner_id: owner1.id
    })
    .and.to.matchResponseDocumentation();

    const reqGet = {
      method: 'GET',
      path: '/stories'
    };

    expect(reqGet).to.matchRequestDocumentation();
  
    const resGet = await testHttpRequest(app, reqGet);
    const expectedOwner = getExpectedOwner(owner1);

    expect(resGet)
      .to.have.status(200)
      .and.to.have.jsonBody([{
        id: 1,
        title: "My story",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: owner1.id,
        owner: {
          id: expectedOwner.id,
          name: expectedOwner.name
        }
      }
      ])
      .and.to.matchResponseDocumentation();


  });

});
