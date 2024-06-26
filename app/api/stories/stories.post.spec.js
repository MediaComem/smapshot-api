const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { createOwner } = require('../../../spec/fixtures/owners');
const { generate } = require('../../../spec/utils/fixtures');
const { getExpectedOwner } = require('../../../spec/expectations/owners');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Add new story with user without the right', async () => {
    const user = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(user);
    const req = {
      method: 'POST',
      path: '/stories',
      body: {
        title: "My story",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: user.owner_id
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(403)
    .and.to.matchResponseDocumentation();
  });


  it('Add new story', async () => {
    const user = await createUser({ roles: [ 'owner_admin' ] });
    const token = await generateJwtFor(user);
    const [ owner1 ] = await generate(1, createOwner);
    const req = {
      method: 'POST',
      path: '/stories',
      body: {
        title: "My story",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: user.owner_id
      },
      headers: {
        Authorization: `Bearer ${token}`
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
      owner_id: user.owner_id
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
        owner_id: user.owner_id,
        owner: {
          id: expectedOwner.id,
          name: expectedOwner.name
        }
      }
      ])
      .and.to.matchResponseDocumentation();


  });

});
