const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');
const { createChapter } = require('../../../spec/fixtures/chapters');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { generate } = require('../../../spec/utils/fixtures');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /stories/:id/chapters/:id', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  /*it('Get empty array when chapters empty', async () => {
    const req = {
      method: 'GET',
      path: '/stories/1/chapters/1'
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(404)
    .and.have.httpProblemDetailsBody({
      type: 'https://httpstatuses.com/404',
      title: 'Not Found',
      status: 404,
      detail: ensureTranslation('general.resourceNotFound')
    })

    await expectNoSideEffects(app);

  });*/

  describe('Get story when stories has one element', () => {
    it('retrieves the stories', async () => {
      const [ owner1 ] = await generate(1, createOwner);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const col1 = await createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 });
      const image = await createImage({ collection: col1, state: 'initial' });
      const story = await createStory({
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg"
      });
      const chapter = await createChapter({
        title: 'titre',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story: story.id,
        indexinstory: 0,
        view_custom: '',
      })
      const req = {
        method: 'GET',
        path: `/stories/${story.id}/chapters/${chapter.id}`
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
  
      expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody()
      .and.to.matchResponseDocumentation();
  
      await expectNoSideEffects(app);
    });
  });
});
