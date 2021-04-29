const { emailFormatError, enumError, minLengthError, typeError } = require('../../../spec/expectations/errors');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { getExpectedUser } = require('../../../spec/expectations/users');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createCorrection } = require('../../../spec/fixtures/corrections');
const { createGeolocalisation } = require('../../../spec/fixtures/geolocalisations');
const { createObservation } = require('../../../spec/fixtures/observations');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { expect } = require('../../../spec/utils/chai');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /users', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/users'
    });
  });

  it('retrieves the authenticated user', async () => {
    const user = await createUser({ roles: [ 'owner_admin' ] });

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
      .and.have.jsonBody([
        getExpectedUser(user)
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not authorize a guest to retrieve the list of users', async () => {
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

  it('does not authorize a volunteer to retrieve the list of users', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const token = await generateJwtFor(volunteer);
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

  it('does not accept invalid query parameters', async () => {
    const user = await createUser({ roles: [ 'owner_admin' ] });
    const token = await generateJwtFor(user);
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      },
      query: {
        email: 'foo',
        language: 'foo',
        letter: 'foo',
        username: 'f'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        emailFormatError({
          location: 'query',
          validation: [ 'format', 'oneOf', 'type' ],
          message: 'should be a valid email address or an array of emails'
        }),
        enumError({ location: 'query', property: 'language' }),
        typeError({ location: 'query', property: 'letter', type: 'boolean' }),
        minLengthError({
          location: 'query',
          property: 'username',
          validation: [ 'minLength', 'oneOf', 'type' ],
          message: 'should be a string or an array of strings at least 2 characters long'
        })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  describe('with default fixtures', () => {
    let bob, alice, mary, robert, tom, rosemary, laura, kate;
    let token;
    let initialState;
    beforeEach(async () => {

      const owner = await createOwner();
      const collection = await createCollection({ owner });

      // Generate 5 users. WARNING: This dataset is used for all the tests in
      // this describe block. These tests check the behavior of various filters.
      // If you change the data, make sure to adapt the tests to the new data.
      [ bob, alice, robert, tom, mary, rosemary, laura, kate ] = await Promise.all([
        // Bob is the owner and administrator of a collection.
        createUser({ username: 'bob', email: 'bob@localhost.localdomain', lang: 'en', letter: false, owner, roles: [ 'owner_admin' ] }),
        // Alice, Mary, Robert and Rosemary have participated in improving and
        // updating Bob's collection.
        createUser({ username: 'alice', email: 'alice@localhost.localdomain', lang: 'fr', letter: true, roles: [ 'volunteer' ] }),
        // Robert is also a validator for Bob's collection.
        createUser({ username: 'robert', email: 'robert@localhost.localdomain', lang: 'fr', letter: false, owner, roles: [ 'owner_validator' ] }),
        // Tom is a new validator for Bob's collection.
        createUser({ username: 'tom', email: 'tom@localhost.localdomain', lang: 'fr', letter: false, owner, roles: [ 'owner_validator' ] }),
        // These two users have a similar username. The fact that "mary" is a
        // suffix of "rosemary" is not a coincidence. It is used to check the
        // exact behavior of the "email" query parameter filter in one test.
        createUser({ username: 'mary', email: 'mary@localhost.localdomain', lang: 'en', letter: true, roles: [ 'volunteer' ] }),
        createUser({ username: 'rosemary', email: 'rosemary@localhost.localdomain', lang: 'it', letter: false, roles: [ 'volunteer' ] }),
        // Laura is a user unrelated to Bob's collection.
        createUser({ username: 'laura', email: 'laura@localhost.localdomain', lang: 'it', letter: false, roles: [ 'volunteer' ] }),
        // Kate is a super administrator unrelated to Bob's collection.
        createUser({ username: 'kate', email: 'kate@localhost.localdomain', lang: 'en', letter: true, roles: [ 'super_admin' ] })
      ]);

      await Promise.all([
        // Bob has geolocated one of his collection's images.
        createGeolocalisation({ user: bob, collection, owner, state: 'validated', validator: bob }),
        // Alice has corrected the metadata of another image, and that
        // correction was rejected by Robert.
        createCorrection({ user: alice, collection, owner, state: 'rejected', validator: robert }),
        // Mary has made an observation on another image, and that observation
        // was validated by Robert.
        createObservation({ user: mary, collection, owner, state: 'validated', validator: robert }),
        // Robert has geolocated another image.
        createGeolocalisation({ user: robert, collection, owner, state: 'validated', validator: robert }),
        // Rosemary has geolocated another image.
        createGeolocalisation({ user: rosemary, collection, owner, state: 'waiting_validation' })
      ]);

      // Generate a JWT for super-admin to have access to all users.
      token = await generateJwtFor(kate);

      // Put the token in the base request.
      baseRequest = freeze({
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      initialState = await loadInitialState();
    });

    it('lists to owner admins all users that contributed (having 1+ geoloc) or are validators', async () => {
      // use owner_admin token
      token = await generateJwtFor(bob);

      // Put the token in the base request.
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
        .and.have.jsonBody([
          getExpectedUser(bob),
          getExpectedUser(robert),
          getExpectedUser(rosemary),
          getExpectedUser(tom)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('lists to owner validators all users that contributed (having 1+ geoloc)', async () => {
      const tokenOwnerValidator = await generateJwtFor(robert);

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerValidator}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(bob),
          getExpectedUser(robert),
          getExpectedUser(rosemary)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('lists to super admin all users', async () => {
      const tokenSuperAdmin = await generateJwtFor(kate);

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenSuperAdmin}`
        }
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(alice),
          getExpectedUser(bob),
          getExpectedUser(kate),
          getExpectedUser(laura),
          getExpectedUser(mary),
          getExpectedUser(robert),
          getExpectedUser(rosemary),
          getExpectedUser(tom)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users matching a case-insensitive username fragment', async () => {

      const req = {
        ...baseRequest,
        query: {
          username: 'oB'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(bob),
          getExpectedUser(robert)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users matching at least one of multiple case-insensitive username fragments', async () => {

      const req = {
        ...baseRequest,
        query: {
          username: [ 'AR', 'ob' ]
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(bob),
          getExpectedUser(mary),
          getExpectedUser(robert),
          getExpectedUser(rosemary)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users matching a case-insensitive email', async () => {

      const req = {
        ...baseRequest,
        query: {
          email: 'MaRy@localhost.LOCALdomain'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          // Note that this returns the user with the email "mary@..." but not
          // "rosemary@...", ensuring that it is an exact case-insensitive match
          // on the email, not a prefix or suffix match.
          getExpectedUser(mary)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users matching at least one of multiple case-insensitive emails', async () => {

      const req = {
        ...baseRequest,
        query: {
          email: [ 'alice@localhost.LOCALdomain', 'BOB@localhost.localdomain' ]
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(alice),
          getExpectedUser(bob)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users who use the specified language', async () => {

      const req = {
        ...baseRequest,
        query: {
          language: 'en'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(bob),
          getExpectedUser(kate),
          getExpectedUser(mary)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects users who have subscribed to the newsletter', async () => {

      const req = {
        ...baseRequest,
        query: {
          letter: true
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedUser(alice),
          getExpectedUser(kate),
          getExpectedUser(mary)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
});
