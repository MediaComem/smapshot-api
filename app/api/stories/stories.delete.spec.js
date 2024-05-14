const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');

// This should be in every integration test file.
setUpGlobalHooks();

describe('DELETE /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Delete a story', async () => {
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg"
    });
    const req = {
      method: 'DELETE',
      path: `/stories/${id}`,
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.matchResponseDocumentation();

    const reqGet = {
      method: 'GET',
      path: '/stories'
    };

    expect(reqGet).to.matchRequestDocumentation();

    const resGet = await testHttpRequest(app, reqGet);

    expect(resGet)
      .to.have.status(200)
      .and.to.have.jsonBody([])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);

  });

});
