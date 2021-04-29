
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { getExpectedCorrection } = require('../../../spec/expectations/corrections');
const { createCorrection } = require('../../../spec/fixtures/corrections');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { expect } = require('../../../spec/utils/chai');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /me/corrections', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/me/corrections'
    });
  });

  it('retrieves an empty list of corrections', async () => {
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
    let volunteerCorrection;

    beforeEach(async () => {

      const volunteer = await createUser({ roles: [ 'volunteer' ] });
      const otherUser = await createUser({ roles: [ 'volunteer' ] });
      // create a submitted correction
      volunteerCorrection = await createCorrection({ user: volunteer });
      // correction from other user
      await createCorrection({ user: otherUser });

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

    it('selects the user\'s corrections and only his', async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedCorrection(volunteerCorrection, { update: null })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

});
