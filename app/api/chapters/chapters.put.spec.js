const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createChapter } = require('../../../spec/fixtures/chapters');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { generate } = require('../../../spec/utils/fixtures');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');

// This should be in every integration test file.
setUpGlobalHooks();

describe('PUT /stories/:storyId/chapters/:id', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  describe('PUT chapter when stories has chapters', () => {
    it('Modify a chapter with not allowed user', async () => {
      const user = await createUser({ roles: [ 'volunteer' ] });
      const token = await generateJwtFor(user);
      const [ owner1 ] = await generate(1, createOwner);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const col1 = await createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 });
      const image = await createImage({ collection: col1, state: 'initial' });
      const story = await createStory({
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: owner1.id
      });
      const chapter = await createChapter({
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: {
          transparency: 0.5,
          showBuilding: true,
          buildingsSlider: 10,
          depthSlider: 15
        },
      })
      const initialState = await loadInitialState();

      chapter.description = 'New Description';

      const req = {
        method: 'PUT',
        path: `/stories/${story.id}/chapters/${chapter.id}`,
        body: chapter,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
 
      expect(res)
      .to.have.status(403)
      .and.to.matchResponseDocumentation();

  
      await expectNoSideEffects(app, initialState);
    });

    it('Modify a chapter', async () => {
      const user = await createUser({ roles: [ 'owner_admin' ] });
      const token = await generateJwtFor(user);
      const [ owner1 ] = await generate(1, createOwner);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const col1 = await createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 });
      const image = await createImage({ collection: col1, state: 'initial' });
      const story = await createStory({
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
        owner_id: owner1.id
      });
      const chapter = await createChapter({
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: {
          transparency: 0.5,
          showBuilding: true,
          buildingsSlider: 10,
          depthSlider: 15
        },
      })
      const initialState = await loadInitialState();

      chapter.description = 'New Description';

      const req = {
        method: 'PUT',
        path: `/stories/${story.id}/chapters/${chapter.id}`,
        body: chapter,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
 
      expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody(chapter)
      .and.to.matchResponseDocumentation();

      const reqGet = {
        method: 'GET',
        path: `/stories/${story.id}/chapters/${chapter.id}`
      };
  
      expect(reqGet).to.matchRequestDocumentation();
  
      const resGet = await testHttpRequest(app, reqGet);
 
      expect(resGet)
      .to.have.status(200)
      .and.to.have.jsonBody(chapter)
      .and.to.matchResponseDocumentation();
  
      await expectNoSideEffects(app, initialState);
    });
  });
});
