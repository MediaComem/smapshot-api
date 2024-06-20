const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');
const { createOwner } = require('../../../spec/fixtures/owners');
const { generate } = require('../../../spec/utils/fixtures');
const { getExpectedOwner } = require('../../../spec/expectations/owners');


// This should be in every integration test file.
setUpGlobalHooks();

describe('PUT /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Update a story', async () => {
    const [ owner1 ] = await generate(1, createOwner);
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg",
      owner_id: owner1.id
    });
    const initialState = await loadInitialState();
    const req = {
      method: 'PUT',
      path: `/stories/${id}`,
      body: {
        title: "My story 2",
        logo_link: "http://localhost2",
        description_preview: "abc2",
        description: "efg2",
        owner_id: owner1.id
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.have.jsonBody({
      id: id,
      title: "My story 2",
      logo_link: "http://localhost2",
      description_preview: "abc2",
      description: "efg2",
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
        title: "My story 2",
        logo_link: "http://localhost2",
        description_preview: "abc2",
        description: "efg2",
        owner_id: owner1.id,
        nbChapters: 0,
        owner: {
          id: expectedOwner.id,
          name: expectedOwner.name
        }
      }
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);

  });

});
