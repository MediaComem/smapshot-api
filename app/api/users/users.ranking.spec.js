const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createUser } = require('../../../spec/fixtures/users');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createGeolocalisation } = require('../../../spec/fixtures/geolocalisations');
const { createCorrection } = require('../../../spec/fixtures/corrections');
const { createObservation } = require('../../../spec/fixtures/observations');
const { generate } = require('../../../spec/utils/fixtures');
const { dateFormatError, enumError, minimumError, typeError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /users/ranking', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/users/ranking'
    });
  });

  it('retrieves an empty list of users', async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody({ count:0, rows:[]})
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not accept invalid query parameters', async () => {

    const req = {
      ...baseRequest,
      query: {
        collection_id: -2,
        owner_id: 'foo',
        date_min: 100,
        date_max: '2017-01-01 12:00:00',
        order_by: 'name',
        order_dir: 'A',
        limit: 'none',
        offset: -10
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        minimumError({ location: 'query', property: 'collection_id', min: '0' }),
        typeError({ location: 'query', property: 'owner_id', type: 'integer' }),
        dateFormatError({ location: 'query', property: 'date_min' }),
        dateFormatError({ location: 'query', property: 'date_max' }),
        enumError({ location: 'query', property: 'order_by' }),
        enumError({ location: 'query', property: 'order_dir' }),
        typeError({ location: 'query', property: 'limit', type: 'integer' }),
        minimumError({ location: 'query', property: 'offset', min: '0' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('with default fixtures', () => {

    let owner1, owner2;
    let col1, col2, col3;
    let bob, alice, robert, sandra;

    let initialState;
    beforeEach(async () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Generate 5 collections belonging to 3 owners.
      [ owner1, owner2 ] = await generate(2, createOwner);
      [ col1, col2, col3 ] = await Promise.all([
        createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 }),
        createCollection({ date_publi: oneYearAgo, owner: owner1 }),
        createCollection({ date_publi: threeMonthsAgo, is_main_challenge: true, is_owner_challenge: true, owner: owner2 }),
      ]);

      // create 5 volunteers
      [ bob, alice, robert, sandra ] = await generate(4, createUser);

      // Geolocations
      // bob contributed to collection 1 and 2
      await createGeolocalisation({ user: bob, collection: col1, stop: yesterday, state: 'validated' });
      await createGeolocalisation({ user: bob, collection: col1, stop: yesterday, state: 'waiting_validation' });
      await createGeolocalisation({ user: bob, collection: col2, stop: yesterday, state: 'validated' });
      // alice did only bad contributions
      await createGeolocalisation({ user: alice, collection: col1, stop: yesterday, state: 'rejected' });
      await createGeolocalisation({ user: alice, collection: col1, stop: yesterday, state: 'rejected' });
      await createGeolocalisation({ user: alice, collection: col3, stop: yesterday, state: 'rejected' });
      // robert contributed to collection 3
      await createGeolocalisation({ user: robert, collection: col3, stop: yesterday, state: 'rejected' });
      await createGeolocalisation({ user: robert, collection: col3, stop: yesterday, state: 'validated' });
      await createGeolocalisation({ user: robert, collection: col3, stop: null, state: 'created' });
      // sandra contributed to collection 3
      await createGeolocalisation({ user: sandra, collection: col3, stop: yesterday, state: 'validated' });
      await createGeolocalisation({ user: sandra, collection: col3, stop: yesterday, state: 'validated' });

      // corrections
      // bob contributed to collection 2
      await createCorrection({ user: bob, collection: col2, state: 'accepted' }),
      await createCorrection({ user: bob, collection: col2, state: 'accepted' }),
      await createCorrection({ user: bob, collection: col2, state: 'rejected' }),
      // Alice contributed to collection 1
      await createCorrection({ user: alice, collection: col1, state: 'accepted' }),
      await createCorrection({ user: alice, collection: col1, state: 'accepted' }),
      await createCorrection({ user: alice, collection: col1, state: 'accepted' }),

      // observations
      // robert contributed to collection 2 and 3
      await createObservation({ user: robert, collection: col2, state: 'validated' }),
      await createObservation({ user: robert, collection: col3, state: 'validated' }),
      await createObservation({ user: robert, collection: col3, state: 'validated' }),
      // Alice contributed to collection 1
      await createObservation({ user: alice, collection: col1, state: 'validated' }),

      initialState = await loadInitialState();
    });

    it('lists correctly ranking', async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 3,
          rows: [
            { id: bob.id, username: bob.username, n_geoloc: 3, n_corr: 2, n_obs: 0},
            { id: sandra.id, username: sandra.username, n_geoloc: 2, n_corr: 0, n_obs: 0},
            { id: robert.id, username: robert.username, n_geoloc: 1, n_corr: 0, n_obs: 3}
          ]
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('lists correctly ranking for a specific collection', async () => {
      const req = {
        ...baseRequest,
        query: {
          collection_id: col3.id
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 2,
          rows: [
            { id: sandra.id, username: sandra.username, n_geoloc: 2, n_corr: 0, n_obs: 0},
            { id: robert.id, username: robert.username, n_geoloc: 1, n_corr: 0, n_obs: 2}
          ]
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('orders correctly by corrections', async () => {
      const req = {
        ...baseRequest,
        query: {
          order_by: 'n_corr'
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 2,
          rows: [
            { id: alice.id, username: alice.username, n_geoloc: 0, n_corr:3, n_obs: 1},
            { id: bob.id, username: bob.username, n_geoloc: 3, n_corr:2, n_obs: 0}
          ]
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('orders correctly by observations', async () => {
      const req = {
        ...baseRequest,
        query: {
          order_by: 'n_obs'
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 2,
          rows: [
            { id: robert.id, username: robert.username, n_geoloc: 1, n_corr:0, n_obs: 3},
            { id: alice.id, username: alice.username, n_geoloc: 0, n_corr:3, n_obs: 1}
          ]
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('count all users correctly even if limit', async () => {
      const req = {
        ...baseRequest,
        query: {
          limit: '1'
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 3,
          rows: [
            { id: bob.id, username: bob.username, n_geoloc: 3, n_corr: 2, n_obs: 0}
          ]
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

  });
})
