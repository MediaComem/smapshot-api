const { expectNoSideEffects, expectSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
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

describe('DELETE /locations/apriori_locations/:aprioriLocationId', () => {
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
      method: 'DELETE',
      path: '/locations/apriori_locations/foo',
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'aprioriLocationId' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'aprioriLocationId', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not authorize a guest to delete an apriori location', async () => {
    const initialState = await loadInitialState();

    const req = {
      method: 'DELETE',
      path: '/locations/apriori_locations/1'
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

  it('does not authorize a volunteer to delete an apriori location', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(volunteer);
    const initialState = await loadInitialState();

    const req = {
      method: 'DELETE',
      path: '/locations/apriori_locations/1',
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
        method: 'DELETE',
        path: `/locations/apriori_locations/${aprioriLocation1.id}`
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

    it('does not authorize access to an inexistant apriori location', async () => {
      const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner1 });
      const token = await generateJwtFor(admin);
      const initialState = await loadInitialState();

      const req = {
        method: 'DELETE',
        path: '/locations/apriori_locations/100',
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
      it(`deletes the apriori location for an ${role} of the same owner`, async () => {
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
            message: "The apriori location was deleted."
          })
          .and.to.matchResponseDocumentation();

        await expectSideEffects(app, {
          initialDatabaseCounts: initialState.initialDatabaseCounts,
          databaseChanges: { apriori_locations: -1 }
        });

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
          .and.to.have.jsonBody([]);
      });
    });

    it('deletes any apriori location for a super administrator', async () => {
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
        .and.to.have.jsonBody({
          message: "The apriori location was deleted."
        })
        .and.to.matchResponseDocumentation();

      await expectSideEffects(app, {
        initialDatabaseCounts: initialState.initialDatabaseCounts,
        databaseChanges: { apriori_locations: -1 }
      });
    });
  });
});
