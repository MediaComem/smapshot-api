const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createImage } = require('../../../spec/fixtures/images');
const { createGeolocalisation } = require('../../../spec/fixtures/geolocalisations');
const { getExpectedImageAttributes } = require('../../../spec/expectations/images');
const { typeError } = require('../../../spec/expectations/errors');
const { testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { generate } = require('../../../spec/utils/fixtures');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createUser } = require('../../../spec/fixtures/users');
const { createCollection } = require('../../../spec/fixtures/collections');
const { __ } = require('i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /images/:id/attributes', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const req = {
      method: 'GET',
      path: '/images/foo/attributes'
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'id' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  it('returns not found for inexistant images', async () => {
    const req = {
      method: 'GET',
      path: '/images/100/attributes'
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: __('general.resourceNotFound')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('initial image', () => {
    let image;
    let initialState;

    beforeEach(async () => {
      // Generate images for the collections.
      image = await createImage({ state: 'initial', apriori_longitude: 7.44, apriori_latitude: 46.95 });
      initialState = await loadInitialState();
    });

    it('retrieves the image', async () => {
      const req = {
        method: 'GET',
        path: `/images/${image.id}/attributes`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedImageAttributes(image, { apriori_altitude: null,
                                              apriori_locations: [{
                                                exact: false,
                                                latitude: 46.95,
                                                longitude: 7.44,
                                                azimuth: null
                                              }],
                                              locked: false, locked_user_id: null, delta_last_start: null,

           })
        )
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})

describe('GET /images/:id/geolocation_id', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const req = {
      method: 'GET',
      path: '/images/foo/geolocation_id'
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'id' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  it('returns not found for inexistant images', async () => {
    const req = {
      method: 'GET',
      path: '/images/100/geolocation_id'
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: __('general.resourceNotFound')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('initial image', () => {
    let image;
    let geolocalisation;
    let initialState;

    beforeEach(async () => {
      // Generate images for the collections.
      geolocalisation = await createGeolocalisation({}),
      image = await createImage({ state: 'initial', apriori_longitude: 7.44, apriori_latitude: 46.95, geolocalisation_id: geolocalisation.id });
      initialState = await loadInitialState();
    });

    it('retrieves the image', async () => {
      const req = {
        method: 'GET',
        path: `/images/${image.id}/geolocation_id`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          geolocalisation_id: image.geolocalisation_id
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})

describe('GET /images/:id/georeferencers', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const req = {
      method: 'GET',
      path: '/images/foo/georeferencers'
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'id' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('without georefencer', () => {
    let image;
    let geolocalisation;
    let initialState;

    beforeEach(async () => {
      // Generate images for the collections.
      geolocalisation = await createGeolocalisation({}),
      image = await createImage({ state: 'initial', apriori_longitude: 7.44, apriori_latitude: 46.95, geolocalisation_id: geolocalisation.id });
      initialState = await loadInitialState();
    });

    it('retrieves the image', async () => {
      const req = {
        method: 'GET',
        path: `/images/${image.id}/georeferencers`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

  describe('with one georefencer', () => {
    let geo1;
    let initialState;

    let owner1;
    let col1;
    let bob;

    beforeEach(async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      [ owner1 ] = await generate(1, createOwner);
      [ col1 ] = await Promise.all([
        createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 }),
      ]);

      [ bob ] = await generate(1, createUser);

      geo1 = await createGeolocalisation({ user: bob, collection: col1, stop: yesterday, state: 'validated' });

      initialState = await loadInitialState();
    });

    it('retrieves the georeferencer', async () => {
      const req = {
        method: 'GET',
        path: `/images/${geo1.image_id}/georeferencers`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([{
          volunteer: {
            id: bob.id,
            username: bob.username
          }
        }])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

  describe('with two georefencers', () => {
    let geo1;
    let initialState;

    let owner1;
    let col1;
    let bob, alice;

    beforeEach(async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      [ owner1 ] = await generate(1, createOwner);
      [ col1 ] = await Promise.all([
        createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 }),
      ]);

      [ bob, alice ] = await generate(2, createUser);

      geo1 = await createGeolocalisation({ user: bob, collection: col1, stop: yesterday, state: 'validated' });
      await createGeolocalisation({ user: alice, collection: col1, stop: yesterday, state: 'validated', image: geo1.image });
      initialState = await loadInitialState();
    });

    it('retrieves the georeferencers', async () => {
      const req = {
        method: 'GET',
        path: `/images/${geo1.image_id}/georeferencers`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([{
          volunteer: {
            id: bob.id,
            username: bob.username
          }
        },
        {
          volunteer: {
            id: alice.id,
            username: alice.username
          }
        }])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})
