const { typeError } = require('../../../spec/expectations/errors');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { generate } = require('../../../spec/utils/fixtures');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createGeolocalisation } = require('../../../spec/fixtures/geolocalisations');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createUser } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { expect } = require('../../../spec/utils/chai');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /stats', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/stats'
    });
  });

  it('retrieves empty stats', async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.have.jsonBody({ nUsers: 0, nGeoref: 0, nCollections: 0 })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not accept invalid query parameters', async () => {

    const req = {
      ...baseRequest,
      query: {
        owner_id: 'foo'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'query', property: 'owner_id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('with default fixtures', () => {
    let bob, alice, mary, robert;
    let owner1;
    let collection1, collection2;
    let initialState;
    beforeEach(async () => {

      owner1 = await createOwner();
      const owner2 = await createOwner();
      collection1 = await createCollection({ owner: owner1 });
      collection2 = await createCollection({ owner: owner2 });

      [bob, alice, mary, robert] = await generate(5, createUser);

      await Promise.all([
        // 4 active users
        createGeolocalisation({ user: bob, collection: collection1, owner: owner1, state: 'validated', validator: bob }),
        createGeolocalisation({ user: alice, collection: collection1, owner: owner1, state: 'rejected', validator: bob }),
        createGeolocalisation({ user: mary, collection: collection1, owner: owner1, state: 'validated', validator: bob }),
        createGeolocalisation({ user: robert, collection: collection2, owner: owner2, state: 'validated', validator: bob }),
        createGeolocalisation({ user: robert, collection: collection2, owner: owner2, state: 'waiting_validation', validator: bob })
      ]);

      initialState = await loadInitialState();
    });

    it('give correct stats', async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody({ nUsers: 5, nGeoref: 4, nCollections: 2 })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('give correct stats for a specific owner', async () => {
      const req = {
        ...baseRequest,
        query: {
          owner_id: owner1.id
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody({ nUsers: 5, nGeoref: 2, nCollections: 1 })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

  });
});
