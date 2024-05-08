const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');

// This should be in every integration test file.
setUpGlobalHooks();

describe('PUT /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Update a story', async () => {
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg"
    });
    const req = {
      method: 'PUT',
      path: `/stories/${id}`,
      body: {
        title: "My story 2",
        logo_link: "http://localhost2",
        description_preview: "abc2",
        description: "efg2"
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
      description: "efg2"
    })
    .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);

  });

});
