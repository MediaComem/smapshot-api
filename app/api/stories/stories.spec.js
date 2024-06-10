const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Get empty array when stories empty', async () => {
    const req = {
      method: 'GET',
      path: '/stories'
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.have.jsonBody([])
    .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);

  });

  describe('Get story when stories has one element', () => {
    it('retrieves the stories', async () => {
      const { id } = await createStory({
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg"
      });
      const initialState = await loadInitialState();
      const req = {
        method: 'GET',
        path: '/stories'
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
  
      expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody([{
        id: id,
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg"
      }
      ])
      .and.to.matchResponseDocumentation();
  
      await expectNoSideEffects(app, initialState);
    });
  });
});
