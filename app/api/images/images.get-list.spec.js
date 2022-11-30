const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { getExpectedImage, getExpectedImageMetadata } = require('../../../spec/expectations/images');
const { enumError, minItemsError, noAdditionalPropertiesError, typeError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { ensureTranslation } = require('../../../spec/utils/i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /images', () => {
  let app;
  let baseRequest;

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/images'
    });
  });

  it('retrieves an empty list of images', async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody({ count: 0, rows: []})
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not accept invalid query parameters', async () => {

    const req = {
      ...baseRequest,
      query: {
        publish_state: [ 'bar' ],
        id: 'foo',
        bbox: [ 5.6, 44.5 ],
        state: 'validated'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'query', property: 'id', type: 'integer', array: true }),
        typeError({ location: 'query', property: 'state', type: 'array' }),
        enumError({ location: 'query', property: 'publish_state' }),
        minItemsError({ location: 'query', property: 'bbox', min: 4 })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  it('does not accept additional query parameters', async () => {
    const req = {
      ...baseRequest,
      query: {
        unknown_param: 'validated'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'imageId' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        noAdditionalPropertiesError({ location: 'query' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('with default fixtures', () => {

    let owner1, owner2;
    let col1, col2;
    let image1, image2, image3, image4, image5, image6;
    let initialState;
    beforeEach(async () => {
      // Generate 5 collections belonging to 3 owners.
      owner1 = await createOwner({ is_published: true });
      owner2 = await createOwner({ is_published: true });
      [ col1, col2 ] = await Promise.all([
        createCollection({ date_publi: yesterday, owner: owner1 }),
        createCollection({ date_publi: threeDaysAgo, owner: owner2 })
      ]);

      // Generate images for the collections.
      image1 = await createImage({ collection: col1, state: 'initial',
                                   apriori_longitude: 7.44, apriori_latitude: 46.95 });
      image2 = await createImage({ collection: col1, state: 'waiting_validation',
                                   apriori_longitude: 7.34, apriori_latitude: 45.95 });
      image3 = await createImage({ collection: col2, state: 'validated', is_published: false,
                                   longitude: 6.65, latitude: 46.78 });
      image4 = await createImage({ collection: col2, state: 'initial', is_published: false,
                                   apriori_longitude: 7.54, apriori_latitude: 47.95 });
      image5 = await createImage({ collection: col2, state: 'validated',
                                   longitude: 6.59, latitude: 46.52 });
      image6 = await createImage({ collection: col1, state: 'initial',
                                   apriori_longitude: 8.54, apriori_latitude: 47.38 });
      initialState = await loadInitialState();
    });

    [undefined, 'published'].forEach(publish_state => {
      it(`retrieves list of published geolocalised images with publish state ${publish_state}`, async () => {
        const req = {
          ...baseRequest,
          query: {
            publish_state: publish_state
          }
        };
        expect(req).to.matchRequestDocumentation();
        const res = await testHttpRequest(app, req);
        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody({
            count: 2,
            rows: [
              getExpectedImage(image2),
              getExpectedImage(image5)
            ]})
          .and.to.matchResponseDocumentation();
        await expectNoSideEffects(app, initialState);
      });
    });

    it('retrieves list of unpublished geolocalised images with publish_state unpublished', async () => {
      const admin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(admin);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        },
        query: {
          publish_state: 'unpublished'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 1,
          rows: [
            getExpectedImage(image3)
          ]})
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves list of all geolocalised images with publish_state all', async () => {
      const admin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(admin);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        },
        query: {
          publish_state: 'all'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 3,
          rows: [
            getExpectedImage(image2),
            getExpectedImage(image3),
            getExpectedImage(image5)
          ]})
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves images inside bounded box for georeferenced images', async () => {
      const req = {
        ...baseRequest,
        query: {
          state: ['waiting_validation', 'validated'],
          bbox: [6.5, 46.5, 6.6, 46.6]
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 1,
          rows: [
            getExpectedImage(image5)
          ]})
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    })

    it('retrieves images inside bounded box for images not georeferenced', async () => {
      const req = {
        ...baseRequest,
        query: {
          state: ['initial', 'waiting_alignment'],
          bbox: [8.5, 46.5, 8.9, 47.6]
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 1,
          rows: [
            getExpectedImage(image6, {
              apriori_locations: [{
                exact: false,
                latitude: 47.38,
                longitude: 8.54,
              }] })
          ]})
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    })

    it('retrieves only specified attributes', async () => {
      const req = {
        ...baseRequest,
        query: {
          attributes: ["id", "latitude", "longitude"]
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 2,
          rows: [
            {
              id: image2.id,
              longitude: null,
              latitude: null,
              collection: { id: 1, date_publi: yesterday.toJSON() }
            },
            {
              id: image5.id,
              // The latitude and longitude returned by the API are computed and
              // may not be exactly equal to the original values from the
              // fixtures.
              longitude: actual => expect(actual).to.be.closeToWithPrecision(6.59),
              latitude: actual => expect(actual).to.be.closeToWithPrecision(46.52),
              collection: { id: 2, date_publi: threeDaysAgo.toJSON() }
            }
          ]})
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    describe('GET /images/metadata', () => {
      let superAdmin;
      let metadataBaseRequest;

      beforeEach(async () => {
        superAdmin = await createUser({ roles: [ 'super_admin' ] });
        metadataBaseRequest = freeze({
          method: 'GET',
          path: '/images/metadata'
        });
      });

      it('does not authorize a guest to retrieve the list of users', async () => {
        const initialState = await loadInitialState();

        const req = metadataBaseRequest;
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(401)
          .and.have.httpProblemDetailsBody({
            type: 'https://httpstatuses.com/401',
            title: 'Unauthorized',
            status: 401,
            detail: ensureTranslation('auth.error.generalServerAuth')
          })
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it('does not authorize a volunteer to retrieve the list of users', async () => {
        const volunteer = await createUser({ roles: [ 'volunteer' ] });
        const token = await generateJwtFor(volunteer);
        const initialState = await loadInitialState();

        const req = {
          ...metadataBaseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(403)
          .and.have.httpProblemDetailsBody({
            type: 'https://httpstatuses.com/403',
            title: 'Forbidden',
            status: 403,
            detail: ensureTranslation('general.accessForbidden')
          })
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it('retrieves images metadata', async () => {
        const token = await generateJwtFor(superAdmin);
        const initialState = await loadInitialState();

        const req = {
          ...metadataBaseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedImageMetadata(image1),
            getExpectedImageMetadata(image2),
            getExpectedImageMetadata(image3),
            getExpectedImageMetadata(image4),
            getExpectedImageMetadata(image5),
            getExpectedImageMetadata(image6)
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

    });
  });
})
