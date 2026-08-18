const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { createAPrioriLocation } = require('../../../spec/fixtures/apriori_locations');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { typeError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { ensureTranslation } = require('../../../spec/utils/i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /locations/:collectionId/apriori_locations', () => {
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
      method: 'GET',
      path: '/locations/foo/apriori_locations',
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'collectionId' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'collectionId', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not authorize a guest to retrieve apriori locations', async () => {
    const initialState = await loadInitialState();

    const req = {
      method: 'GET',
      path: '/locations/1/apriori_locations'
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

  it('does not authorize a volunteer to retrieve apriori locations', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(volunteer);
    const initialState = await loadInitialState();

    const req = {
      method: 'GET',
      path: '/locations/1/apriori_locations',
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
    let col1, col2;
    let image1, image2, image3, image5;
    let aprioriLocation1, aprioriLocation2, aprioriLocation3;
    let baseRequest;

    beforeEach(async () => {
      owner1 = await createOwner();
      owner2 = await createOwner();
      [ col1, col2 ] = await Promise.all([
        createCollection({ owner: owner1 }),
        createCollection({ owner: owner2 })
      ]);

      // Image in the default 'initial' state and an a priori location: included by default.
      image1 = await createImage({ collection: col1, state: 'initial' });
      aprioriLocation1 = await createAPrioriLocation({
        image_id: image1.id, longitude: 7.44, latitude: 46.95, azimuth: 12.5, exact: false
      });

      // Image in a different state: excluded by default since the default state filter is 'initial'.
      image2 = await createImage({ collection: col1, state: 'waiting_validation' });
      aprioriLocation2 = await createAPrioriLocation({
        image_id: image2.id, longitude: 7.34, latitude: 45.95, exact: true
      });

      // Image with a validated state: excluded by default since the default state filter is 'initial'.
      image3 = await createImage({ collection: col1, state: 'validated' });
      aprioriLocation3 = await createAPrioriLocation({ image_id: image3.id, longitude: 7.5, latitude: 46 });

      // Image without any a priori location: nothing to include.
      await createImage({ collection: col1, state: 'initial' });

      // Image belonging to another collection: its a priori location must be excluded.
      image5 = await createImage({ collection: col2, state: 'initial' });
      await createAPrioriLocation({ image_id: image5.id, longitude: 6.5, latitude: 46.5 });

      baseRequest = freeze({
        method: 'GET',
        path: `/locations/${col1.id}/apriori_locations`
      });
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

    [ 'owner_admin', 'owner_validator' ].forEach(role => {
      it(`retrieves the collection's apriori locations in the default 'initial' state for an ${role} of the same owner`, async () => {
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
          .and.to.have.jsonBody([
            {
              id: aprioriLocation1.id,
              image_id: image1.id,
              longitude: 7.44,
              latitude: 46.95,
              azimuth: 12.5,
              exact: false,
              title: image1.title
            }
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    it('accepts the lang query parameter', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        query: {
          lang: 'fr'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          {
            id: aprioriLocation1.id,
            image_id: image1.id,
            longitude: 7.44,
            latitude: 46.95,
            azimuth: 12.5,
            exact: false,
            title: image1.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves the apriori locations of any collection in the default \'initial\' state for a super administrator', async () => {
      const superAdmin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(superAdmin);
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
        .and.to.have.jsonBody([
          {
            id: aprioriLocation1.id,
            image_id: image1.id,
            longitude: 7.44,
            latitude: 46.95,
            azimuth: 12.5,
            exact: false,
            title: image1.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves an empty list for a collection with no matching a priori locations', async () => {
      const emptyCollection = await createCollection({ owner: owner1 });
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const newInitialState = await loadInitialState();

      const req = {
        method: 'GET',
        path: `/locations/${emptyCollection.id}/apriori_locations`,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, newInitialState);
    });

    it('does not accept an invalid state query parameter', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        query: {
          state: 'foo'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'state' ] });

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(400)
        .and.to.have.requestParametersValidationErrors([
          {
            location: 'query',
            path: '/state',
            message: 'should be a valid image state or an array of valid image states',
            validation: [ 'enum', 'oneOf', 'type' ]
          },
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('filters the apriori locations to a single requested state', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        query: {
          state: 'validated'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          {
            id: aprioriLocation3.id,
            image_id: image3.id,
            longitude: 7.5,
            latitude: 46,
            azimuth: null,
            exact: false,
            title: image3.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('filters the apriori locations to several requested states', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        query: {
          state: [ 'initial', 'waiting_validation' ]
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          {
            id: aprioriLocation1.id,
            image_id: image1.id,
            longitude: 7.44,
            latitude: 46.95,
            azimuth: 12.5,
            exact: false,
            title: image1.title
          },
          {
            id: aprioriLocation2.id,
            image_id: image2.id,
            longitude: 7.34,
            latitude: 45.95,
            azimuth: null,
            exact: true,
            title: image2.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
});

describe('GET /locations/images/:imageId/apriori_locations', () => {
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
      method: 'GET',
      path: '/locations/images/foo/apriori_locations',
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

  it('does not authorize a guest to retrieve apriori locations', async () => {
    const initialState = await loadInitialState();

    const req = {
      method: 'GET',
      path: '/locations/images/1/apriori_locations'
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

  it('does not authorize a volunteer to retrieve apriori locations', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(volunteer);
    const initialState = await loadInitialState();

    const req = {
      method: 'GET',
      path: '/locations/images/1/apriori_locations',
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
    let col1, col2;
    let image1, imageValidated, imageWithoutAprioriLocation, imageOfAnotherOwner;
    let aprioriLocation1, aprioriLocationValidated;
    let baseRequest;

    beforeEach(async () => {
      owner1 = await createOwner();
      owner2 = await createOwner();
      [ col1, col2 ] = await Promise.all([
        createCollection({ owner: owner1 }),
        createCollection({ owner: owner2 })
      ]);

      // Image with an a priori location: included regardless of its state.
      image1 = await createImage({ collection: col1, state: 'initial' });
      aprioriLocation1 = await createAPrioriLocation({
        image_id: image1.id, longitude: 7.44, latitude: 46.95, azimuth: 12.5, exact: false
      });

      // Image with a validated state: included as well since state is not filtered for this route.
      imageValidated = await createImage({ collection: col1, state: 'validated' });
      aprioriLocationValidated = await createAPrioriLocation({ image_id: imageValidated.id, longitude: 7.5, latitude: 46 });

      // Image without any a priori location: nothing to include.
      imageWithoutAprioriLocation = await createImage({ collection: col1, state: 'initial' });

      // Image belonging to another owner: used to check the authorization scope.
      imageOfAnotherOwner = await createImage({ collection: col2, state: 'initial' });
      await createAPrioriLocation({ image_id: imageOfAnotherOwner.id, longitude: 6.5, latitude: 46.5 });

      baseRequest = freeze({
        method: 'GET',
        path: `/locations/images/${image1.id}/apriori_locations`
      });
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
        method: 'GET',
        path: '/locations/images/100/apriori_locations',
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

    [ 'owner_admin', 'owner_validator' ].forEach(role => {
      it(`retrieves the apriori locations of an image for an ${role} of the same owner`, async () => {
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
          .and.to.have.jsonBody([
            {
              id: aprioriLocation1.id,
              image_id: image1.id,
              longitude: 7.44,
              latitude: 46.95,
              azimuth: 12.5,
              exact: false,
              title: image1.title
            }
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    it('accepts the lang query parameter', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        query: {
          lang: 'fr'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          {
            id: aprioriLocation1.id,
            image_id: image1.id,
            longitude: 7.44,
            latitude: 46.95,
            azimuth: 12.5,
            exact: false,
            title: image1.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves the apriori locations of any image for a super administrator', async () => {
      const superAdmin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(superAdmin);
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
        .and.to.have.jsonBody([
          {
            id: aprioriLocation1.id,
            image_id: image1.id,
            longitude: 7.44,
            latitude: 46.95,
            azimuth: 12.5,
            exact: false,
            title: image1.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves the apriori location of a validated image regardless of its state', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        method: 'GET',
        path: `/locations/images/${imageValidated.id}/apriori_locations`,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          {
            id: aprioriLocationValidated.id,
            image_id: imageValidated.id,
            longitude: 7.5,
            latitude: 46,
            azimuth: null,
            exact: false,
            title: imageValidated.title
          }
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieves an empty list for an image without any a priori location', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        method: 'GET',
        path: `/locations/images/${imageWithoutAprioriLocation.id}/apriori_locations`,
        headers: {
          Authorization: `Bearer ${token}`
        }
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
});
