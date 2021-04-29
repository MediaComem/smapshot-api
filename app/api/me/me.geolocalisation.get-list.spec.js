
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { getExpectedGeolocation } = require('../../../spec/expectations/geolocations');
const { createGeolocalisation } = require('../../../spec/fixtures/geolocalisations');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { expect } = require('../../../spec/utils/chai');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /me/geolocalisations', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/me/geolocalisations'
    });
  });

  it('retrieves an empty list of geolocations', async () => {
    const user = await createUser({ roles: [ 'volunteer' ] });

    const initialState = await loadInitialState();

    const token = await generateJwtFor(user);

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
      .and.have.jsonBody([])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not authorize a guest to retrieve data', async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;
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

  describe('with default fixtures', () => {
    let token;
    let initialState;
    let volunteerGeolocation;

    beforeEach(async () => {

      const volunteer = await createUser({ roles: [ 'volunteer' ] });
      const otherUser = await createUser({ roles: [ 'volunteer' ] });
      // create a submitted geolocation
      volunteerGeolocation = await createGeolocalisation({ user: volunteer, stop: new Date() });
      // geolocation from other user
      await createGeolocalisation({ user: otherUser, stop: new Date() });

      // Generate a JWT for the first user, who will make the request.
      token = await generateJwtFor(volunteer);

      // Put the token in the base request.
      baseRequest = freeze({
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      initialState = await loadInitialState();

      await expectNoSideEffects(app, initialState);

    });

    it('selects the user\'s geolocations and only his', async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedGeolocation(volunteerGeolocation)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

});
