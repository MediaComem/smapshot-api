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
const { countDatabaseRows } = require('../../../spec/utils/db');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');


// This should be in every integration test file.
setUpGlobalHooks();

describe('DELETE /stories/:storyId/chapters/:id', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Delete a story with user without the right', async () => {
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

    const req = {
      method: 'DELETE',
      path: `/stories/${story.id}/chapters/${chapter.id}`,
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

  it('Delete a story', async () => {
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
    const initialState = await loadInitialState();
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

    let currentCounts = await countDatabaseRows();
    expect(currentCounts['stories_chapters']).to.be.equals(1);

    const req = {
      method: 'DELETE',
      path: `/stories/${story.id}/chapters/${chapter.id}`,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.matchResponseDocumentation();

    currentCounts = await countDatabaseRows();
    expect(currentCounts['stories_chapters']).to.be.equals(0);

    await expectNoSideEffects(app, initialState);

  });

  it('Delete a story when multiple is present and be sure that the index is correct', async () => {
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

    for (let i = 1; i < 6; i++) {
      await createChapter({
        title: 'titre',
        type: 'IMAGE',
        picture_id: image.id,
        url_media: '',
        description: 'description',
        zoom: 14,
        story_id: story.id,
        indexinstory: i,
        view_custom: {
          transparency: 0.5,
          showBuilding: true,
          buildingsSlider: 10,
          depthSlider: 15
        },
      })
    }
   

    let currentCounts = await countDatabaseRows();
    expect(currentCounts['stories_chapters']).to.be.equals(5);

    const req = {
      method: 'DELETE',
      path: `/stories/${story.id}/chapters/2`,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.matchResponseDocumentation();

    currentCounts = await countDatabaseRows();
    expect(currentCounts['stories_chapters']).to.be.equals(4);

    const reqGetStory = {
      method: 'GET',
      path: `/stories/${story.id}`
    };

    expect(reqGetStory).to.matchRequestDocumentation();

    const resStory = await testHttpRequest(app, reqGetStory);

    const chapterToCheck = JSON.parse(resStory.res.text);
    const arrayOfIndex = [];
    chapterToCheck.chapters.forEach((chapter) => {
      arrayOfIndex.push(chapter.indexinstory);
    })
    expect(arrayOfIndex).to.eql([1,2,3,4]);
  });

  it('Delete a story without owner_right', async () => {
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

    const currentCounts = await countDatabaseRows();
    expect(currentCounts['stories_chapters']).to.be.equals(1);
    const initialState = await loadInitialState();
    const req = {
      method: 'DELETE',
      path: `/stories/${story.id}/chapters/${chapter.id}`,
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

});
