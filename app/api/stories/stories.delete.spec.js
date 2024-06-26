const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { expect } = require('../../../spec/utils/chai');
const { testHttpRequest } = require('../../../spec/utils/api');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createStory } = require('../../../spec/fixtures/stories');
const { countDatabaseRows } = require('../../../spec/utils/db');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');


// This should be in every integration test file.
setUpGlobalHooks();

describe('DELETE /stories', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('Delete a story', async () => {
    const user = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(user);
    
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg",
      owner_id: user.owner_id
    });

    const currentCounts = await countDatabaseRows();
    expect(currentCounts['stories']).to.be.equals(1);

    const initialState = await loadInitialState();

    const req = {
      method: 'DELETE',
      path: `/stories/${id}`,
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
    const initialState = await loadInitialState();
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg",
      owner_id: user.owner_id
    });

    const currentCounts = await countDatabaseRows();
    expect(currentCounts['stories']).to.be.equals(1);

    const req = {
      method: 'DELETE',
      path: `/stories/${id}`,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
    .to.have.status(200)
    .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);

  });

  it('Delete a story without the owner right', async () => {
    const user = await createUser({ roles: [ 'owner_admin' ] });
    const token = await generateJwtFor(user);
    const { id } = await createStory({
      title: "Mon titre",
      logo_link: "http://localhost",
      description_preview: "abc",
      description: "efg",
    });

    const currentCounts = await countDatabaseRows();
    expect(currentCounts['stories']).to.be.equals(1);

    const initialState = await loadInitialState();

    const req = {
      method: 'DELETE',
      path: `/stories/${id}`,
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
