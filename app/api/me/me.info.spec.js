const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { emailFormatError, minLengthError, missingPropertyError, enumError, typeError } = require('../../../spec/expectations/errors');
const { expectUserInDatabase, getExpectedUser } = require('../../../spec/expectations/users');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /me/info', () => {

  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/me/info'
    });
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

  it('refuses expired token', async () => {

    const user = await createUser({
      password: 'letmein'
    });
    const token = await generateJwtFor(user, {expiresIn: 0});

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
    let initialState;
    let volunteer, owner_validator, owner_admin;
    let token_volunteer, token_validator, token_admin;

    beforeEach(async () => {
      volunteer = await createUser({ roles: [ 'volunteer' ] });
      owner_validator = await createUser({ roles: [ 'volunteer', 'owner_validator' ] });
      owner_admin = await createUser({ roles: [ 'volunteer', 'owner_validator', 'owner_admin' ] });

      // Generate a JWT for the first user, who will make the request.
      token_volunteer = await generateJwtFor(volunteer);
      token_validator = await generateJwtFor(owner_validator);
      token_admin = await generateJwtFor(owner_admin);

      initialState = await loadInitialState();

      await expectNoSideEffects(app, initialState);

    });

    it('returns correct user info for a volunteer', async () => {
      const initialState = await loadInitialState();

      // Put the token in the base request.
      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token_volunteer}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody(getExpectedUser(volunteer, { date_registr: false, local_login: true, owner_id: null }))
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('returns correct owner_id for an owner validator', async () => {
      const initialState = await loadInitialState();

      // Put the token in the base request.
      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token_validator}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody(getExpectedUser(owner_validator, { date_registr: false, local_login: true, owner_id: owner_validator.owner.id }))
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('returns correct owner_id for an owner admin', async () => {
      const initialState = await loadInitialState();

      // Put the token in the base request.
      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token_admin}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody(getExpectedUser(owner_admin, { date_registr: false, local_login: true, owner_id: owner_admin.owner.id }))
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
});

describe('PUT /me/info', () => {

  let app;
  let baseRequest;
  let user, token;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
    user = await createUser({ active: true, lang:'en', letter: false });
    // Generate a JWT for the user (to be added in header of authorized requests).
    token = await generateJwtFor(user);

    baseRequest = freeze({
      method: 'PUT',
      path: '/me/info',
      body: {}
    });
  });

  it('does not authorize a guest to modify data', async () => {
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
    await expectUserInDatabase(user); // since expectNoSideEffects does not catch update, check user was not modified
  });

  it('does not accept invalid query parameters', async () => {
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        email: 'that_is_not_an.email',
        username: 'a',
        first_name: 42,
        last_name: 'b',
        lang: 'foo',
        letter: [ 'bar' ]
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidBody: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        emailFormatError(),
        minLengthError({
          property: 'username',
          limit: 2
        }),
        typeError({
          property: 'first_name',
          type: 'string'
        }),
        minLengthError({
          property: 'last_name',
          limit: 2
        }),
        enumError({ location: 'body', property: 'lang' }),
        typeError({
          property: 'letter',
          type: 'boolean'
        })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
    await expectUserInDatabase(user); // since expectNoSideEffects does not catch update, check user was not modified
  });

  it('correctly updates user info', async () => {
    const info = {
      email: 'new@mail.com',
      username: 'username',
      first_name: 'firstname',
      last_name: 'lastname',
      lang: 'fr',
      letter: true
    }

    // Put the token in the request
    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: info
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.noBody()
      .and.to.matchResponseDocumentation({ noContent: true });

    await expectUserInDatabase({
      ...user,
      email: info.email,
      username: info.username,
      first_name: info.first_name,
      last_name: info.last_name,
      lang: info.lang,
      letter: info.letter
    });
  });
});


describe('PUT /me/password', () => {

  let app;
  let baseRequest;
  let user, token;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
    user = await createUser({ active: true, lang:'en', letter: false, password: 'password_to_change' });
    // Generate a JWT for the user (to be added in header of authorized requests).
    token = await generateJwtFor(user);

    baseRequest = freeze({
      method: 'PUT',
      path: '/me/password',
      body: {}
    });
  });

  it('does not authorize a guest to modify data', async () => {
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      body: {
        old_pwd: "password",
        new_pwd: 'password2'
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
        detail: ensureTranslation('auth.error.generalServerAuth')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
    await expectUserInDatabase(user); // since expectNoSideEffects does not catch update, check user was not modified
  });

  it('does not accept invalid query parameters', async () => {
    const initialState = await loadInitialState();
    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        new_pwd: 'short'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidBody: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        missingPropertyError({
          property: 'old_pwd'
        }),
        minLengthError({
          property: 'new_pwd',
          limit: 6
        })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
    await expectUserInDatabase(user); // since expectNoSideEffects does not catch update, check user was not modified
  });

  it('correctly updates user password', async () => {
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        old_pwd: 'password_to_change',
        new_pwd: 'new_password'
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.noBody()
      .and.to.matchResponseDocumentation({ noContent: true });

    await expectNoSideEffects(app, initialState);
    await expectUserInDatabase({
      ...user,
      password: password => expect(password).to.be.bcryptHashFor('new_password'),
    });
  });

  it('refuses to update password if old password does not match', async () => {
    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        old_pwd: 'wrong_password',
        new_pwd: 'new_password'
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(403)
      .and.to.matchResponseDocumentation();

    await expectUserInDatabase(user); // since expectNoSideEffects does not catch update, check user was not modified
  });
});
