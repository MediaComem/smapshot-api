const { __ } = require('i18n');

const { emailFormatError, minLengthError } = require('../../../spec/expectations/errors');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createUser } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /auth/local/login', () => {

  let app;
  let testStart;
  let baseRequestFactory;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
    testStart = new Date();

    baseRequestFactory = user => freeze({
      method: 'POST',
      path: '/auth/local/login',
      body: {
        email: user ? user.email : undefined,
        password: 'letmein'
      }
    });
  });

  it('logs in a user with a local account', async () => {

    const user = await createUser({
      password: 'letmein'
    });

    const initialState = await loadInitialState();

    const req = baseRequestFactory(user);
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody({
        token: token => expect(token).to.be.jwtToken({
          iat: iat => expect(iat).to.be.immediatelyAfter(testStart),
          id: user.id
        }),
        user: {
          email: user.email,
          username: user.username
        }
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('refuses to log in a user that does not exist', async () => {

    // Create a user for this test anyway to make sure the API does not log in
    // any random user present the database.
    const user = await createUser({
      password: 'letmein'
    });

    const initialState = await loadInitialState();

    const baseRequest = baseRequestFactory(user);
    const req = {
      ...baseRequest,
      body: {
        ...baseRequest.body,
        email: `foo${user.email}`
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(401)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: __('auth.error.incorrectEmail')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('refuses to log in a user with the wrong password', async () => {

    const user = await createUser({
      password: 'letmein'
    });

    const initialState = await loadInitialState();

    const baseRequest = baseRequestFactory(user);
    const req = {
      ...baseRequest,
      body: {
        ...baseRequest.body,
        password: 'foobar'
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(401)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: __('auth.error.incorrectPassword')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('refuses to log in an inactive user', async () => {

    const user = await createUser({
      active: false,
      password: 'letmein'
    });

    const initialState = await loadInitialState();

    const req = baseRequestFactory(user);
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(401)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: __('auth.error.accountNotActivated')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('refuses invalid data', async () => {

    const baseRequest = baseRequestFactory();
    const req = {
      ...baseRequest,
      body: {
        ...baseRequest.body,
        email: 'foo',
        password: 'bar'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidBody: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        emailFormatError(),
        minLengthError({
          property: 'password',
          limit: 6
        })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });
});
