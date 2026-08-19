const { expectNoSideEffects, expectSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { createAPrioriLocation } = require('../../../spec/fixtures/apriori_locations');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { missingPropertyError, typeError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { ensureTranslation } = require('../../../spec/utils/i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('PUT /locations/images/:imageId/exact-location', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const admin = await createUser({ roles: [ 'owner_admin' ] });
    const token = await generateJwtFor(admin);
    const initialState = await loadInitialState();

    const req = {
      method: 'PUT',
      path: '/locations/images/foo/exact-location',
      body: { longitude: 7.44, latitude: 46.95 },
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'imageId' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'imageId', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not authorize a guest to update the exact location', async () => {
    const initialState = await loadInitialState();

    const req = {
      method: 'PUT',
      path: '/locations/images/1/exact-location',
      body: { longitude: 7.44, latitude: 46.95 }
    };
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

  it('does not authorize a volunteer to update the exact location', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(volunteer);
    const initialState = await loadInitialState();

    const req = {
      method: 'PUT',
      path: '/locations/images/1/exact-location',
      body: { longitude: 7.44, latitude: 46.95 },
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

  describe('with default fixtures', () => {

    let owner1, owner2;
    let col1;
    let image1;
    let aprioriLocation1;
    let baseRequest;

    beforeEach(async () => {
      owner1 = await createOwner();
      owner2 = await createOwner();
      col1 = await createCollection({ owner: owner1 });

      image1 = await createImage({ collection: col1, state: 'initial' });
      aprioriLocation1 = await createAPrioriLocation({
        image_id: image1.id, longitude: 7.44, latitude: 46.95, azimuth: 12.5, exact: false
      });

      baseRequest = freeze({
        method: 'PUT',
        path: `/locations/images/${image1.id}/exact-location`,
        body: { longitude: 7.5, latitude: 47 }
      });
    });

    it('does not accept a request body missing required properties', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        body: {},
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation({ invalidBody: true });

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.requestBodyValidationErrors([
          missingPropertyError({ property: 'longitude' }),
          missingPropertyError({ property: 'latitude' })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('does not authorize an owner administrator from another owner', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner2 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
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

    it('does not authorize access to an inexistant image', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        path: '/locations/images/100/exact-location',
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

    [ 'waiting_validation', 'validated' ].forEach(state => {
      it(`does not allow updating the exact location of an image already in the ${state} state`, async () => {
        const georeferencedImage = await createImage({ collection: col1, state });
        await createAPrioriLocation({ image_id: georeferencedImage.id, longitude: 7.44, latitude: 46.95 });

        const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
        const token = await generateJwtFor(admin);
        const initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          path: `/locations/images/${georeferencedImage.id}/exact-location`,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.requestBodyValidationErrors([
            {
              location: 'body',
              path: '',
              message: ensureTranslation('locations.imageAlreadyGeoreferenced'),
              validation: 'imageAlreadyGeoreferenced'
            }
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    [ 'owner_admin', 'owner_validator' ].forEach(role => {
      it(`replaces the apriori location of an image with a new exact one for an ${role} of the same owner`, async () => {
        const user = await createUser({ roles: [ role ], owner: owner1 });
        const token = await generateJwtFor(user);
        const initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody({
            id: actualId => expect(actualId).to.be.a('number').and.not.equal(aprioriLocation1.id),
            image_id: image1.id,
            longitude: 7.5,
            latitude: 47,
            azimuth: null,
            exact: true
          })
          .and.to.matchResponseDocumentation();

        // Replacing the previous apriori location destroys the old row and
        // creates a new one, for a net change of zero.
        await expectSideEffects(app, {
          initialDatabaseCounts: initialState.initialDatabaseCounts,
          databaseChanges: { apriori_locations: 0 }
        });

        // The old apriori location must be gone, replaced by the new one.
        const getReq = {
          method: 'GET',
          path: `/locations/images/${image1.id}/apriori_locations`,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
        const getRes = await testHttpRequest(app, getReq);
        expect(getRes)
          .to.have.status(200)
          .and.to.have.jsonBody([
            {
              id: res.body.id,
              image_id: image1.id,
              longitude: 7.5,
              latitude: 47,
              azimuth: null,
              exact: true,
              title: image1.title,
              original_id: image1.original_id
            }
          ]);
      });
    });

    it('creates an apriori location for an image without one, for a super administrator', async () => {
      const imageWithoutAprioriLocation = await createImage({ collection: col1, state: 'initial' });
      const superAdmin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(superAdmin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        path: `/locations/images/${imageWithoutAprioriLocation.id}/exact-location`,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          id: actualId => expect(actualId).to.be.a('number'),
          image_id: imageWithoutAprioriLocation.id,
          longitude: 7.5,
          latitude: 47,
          azimuth: null,
          exact: true
        })
        .and.to.matchResponseDocumentation();

      await expectSideEffects(app, {
        initialDatabaseCounts: initialState.initialDatabaseCounts,
        databaseChanges: { apriori_locations: 1 }
      });
    });
  });
});
