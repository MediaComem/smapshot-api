const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { createStory } = require('../../../spec/fixtures/stories');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createChapter } = require('../../../spec/fixtures/chapters');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { generate } = require('../../../spec/utils/fixtures');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /stories/:id/chapters', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  describe('Post chapter when user has not the right to create a chapter', () => {
    it('Add a chapter', async () => {
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
        owner_id: user.owner_id
      });
      const chapter = {
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: null,
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
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
  
    });
    it('Add a chapter', async () => {
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
        owner_id: user.owner_id
      });
      const chapter = {
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: null,
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
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
  
    });
    
    it('Add a chapter without owner right', async () => {
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
      const chapter = {
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: null,
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
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
  
    });
  });

  describe('Post chapter when stories has no chapters and there is no view_custom', () => {
    it('Add a chapter', async () => {
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
        owner_id: user.owner_id
      });
      const chapter = {
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: 0,
        view_custom: null,
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
        body: chapter,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      chapter.id = 1;
 
      expect(res)
      .to.have.status(201)
      .and.to.have.jsonBody(chapter)
      .and.to.matchResponseDocumentation();
  
    });
  });

  describe('Post chapter when stories has no chapters', () => {
    it('Add a chapter', async () => {
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
        owner_id: user.owner_id
      });

      const chapter = {
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
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
        body: chapter,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      chapter.id = 1;
 
      expect(res)
      .to.have.status(201)
      .and.to.have.jsonBody(chapter)
      .and.to.matchResponseDocumentation();
  
    });
  });

  describe('Post chapter when stories has chapters', () => {
    it('Add a chapter', async () => {
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
        owner_id: user.owner_id
      });
      await createChapter({
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

      const chapter = {
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description2',
        zoom: 15,
        story_id: story.id,
        indexinstory: 0,
        view_custom: {
          transparency: 1,
          showBuilding: true,
          buildingsSlider: 10,
          depthSlider: 15
        },
      }

      const req = {
        method: 'POST',
        path: `/stories/${story.id}/chapters`,
        body: chapter,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      chapter.id = 2;
 
      expect(res)
      .to.have.status(201)
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
    });
  });
});
