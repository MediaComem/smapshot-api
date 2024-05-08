const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects } = require('../../../spec/expectations/side-effects');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Add new story', async () => {
    const req = {
      method: 'POST',
      path: '/stories',
      body: {
        title: "My story",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg"
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
      description: "efg"
    })
    .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);

  });

});
