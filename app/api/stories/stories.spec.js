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
const { createChapter } = require('../../../spec/fixtures/chapters');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');

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
        method: 'GET',
        path: '/stories'
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      const expectedOwner = getExpectedOwner(owner1);
  
      expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody([{
        id: id,
        title: "Mon titre",
        logo_link: "http://localhost",
        description_preview: "abc",
        description: "efg",
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

  describe('Get multiple stores with few element and few owners', () => {
    it('retrieves the stories', async () => {
      const [ owner1, owner2, owner3 ] = await generate(3, createOwner);
      const expectedOwner1 = getExpectedOwner(owner1);
      const expectedOwner2 = getExpectedOwner(owner2);
      const expectedOwner3 = getExpectedOwner(owner3);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const col1 = await createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 });
      const image = await createImage({ collection: col1, state: 'initial' });
      const stories = [];
      const chapters = [];
      for (let i = 1; i <= 3; i++) {
        const story = await createStory({owner_id: owner1.id});
        story.owner = {
          id: expectedOwner1.id,
          name: expectedOwner1.name
        }
        story.nbChapters = 2;
        stories.push(story);
        for (let j = 0; j < 2; j++) {
          chapters.push(await createChapter({
            title: 'titre',
            type: 'IMAGE',
            picture_id: image.id,
            url_media: '',
            description: 'description',
            zoom: 14,
            story_id: story.id,
            indexinstory: j,
          }))
        }
      }
      for (let i = 1; i <= 4; i++) {
        const story = await createStory({owner_id: owner2.id});
        story.nbChapters = 3;
        story.owner = {
          id: expectedOwner2.id,
          name: expectedOwner2.name
        }
        stories.push(story);
        for (let j = 0; j < 3; j++) {
          chapters.push(await createChapter({
            title: 'titre',
            type: 'IMAGE',
            picture_id: image.id,
            url_media: '',
            description: 'description',
            zoom: 14,
            story_id: story.id,
            indexinstory: j,
          }))
        }
      }
      for (let i = 1; i <= 5; i++) {
        const story = await createStory({owner_id: owner3.id});
        story.nbChapters = 4;
        story.owner = {
          id: expectedOwner3.id,
          name: expectedOwner3.name
        }
        stories.push(story);
        for (let j = 0; j < 4; j++) {
          chapters.push(await createChapter({
            title: 'titre',
            type: 'IMAGE',
            picture_id: image.id,
            url_media: '',
            description: 'description',
            zoom: 14,
            story_id: story.id,
            indexinstory: j,
          }))
        }
        
      }
      const initialState = await loadInitialState();
      const req = {
        method: 'GET',
        path: '/stories'
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody(stories.reverse())
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
    });
  });
});
