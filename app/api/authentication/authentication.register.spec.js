const { decode: decodeHtml } = require('he');
const { __ } = require('i18n');
const { URL } = require('url');

const { emailFormatError, minLengthError, missingPropertyError, typeError, uniqueError } = require('../../../spec/expectations/errors');
const { expectNoSideEffects, expectSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { expectUserInDatabase } = require('../../../spec/expectations/users');
const { createUser } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');


// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /auth/local/register', () => {

  let app;
  let sendMailMock;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app, sendMailMock } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'POST',
      path: '/auth/local/register',
      body: {
        email: 'john.doe@localhost.localdomain',
        password: 'letmein',
        username: 'jdoe',
        return_url: 'http://localhost:1337/example'
      }
    });
  });

  it('registers a new user account', async () => {

    // Make the send mail mock return a successful result.
    sendMailMock.onFirstCall().resolves(undefined);

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(201)
      .and.to.have.jsonBody({
        message: __('auth.createAccount.success')
      })
      .and.to.matchResponseDocumentation();

    const { mail } = await expectSideEffects(app, {
      databaseChanges: { users: 1 },
      mailSent: {
        subject: `Smapshot: ${__('auth.confirmAccount.emailTitle')}`,
        to: 'john.doe@localhost.localdomain'
      }
    });

    const tokenFromMailLink = expectLinkWithTokenInHtml('http://localhost:1337/example', mail.html);

    await expectUserInDatabase({
      active: false,
      active_expires: active_expires => expect(active_expires).to.be.a('date'),
      active_token: tokenFromMailLink,
      date_registr: date_registr => expect(date_registr).to.be.a('date'),
      email: req.body.email,
      password: password => expect(password).to.be.bcryptHashFor('letmein'),
      roles: [ 'volunteer' ],
      username: req.body.username
    });
  });

  it('registers a new user account with all optional properties', async () => {

    // Make the send mail mock return a successful result.
    sendMailMock.onFirstCall().resolves(undefined);

    const req = {
      ...baseRequest,
      body: {
        ...baseRequest.body,
        letter: true
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(201)
      .and.to.have.jsonBody({
        message: __('auth.createAccount.success')
      })
      .and.to.matchResponseDocumentation();

    const { mail } = await expectSideEffects(app, {
      databaseChanges: { users: 1 },
      mailSent: {
        subject: `Smapshot: ${__('auth.confirmAccount.emailTitle')}`,
        to: 'john.doe@localhost.localdomain'
      }
    });

    const tokenFromMailLink = expectLinkWithTokenInHtml('http://localhost:1337/example', mail.html);

    await expectUserInDatabase({
      active: false,
      active_expires: active_expires => expect(active_expires).to.be.a('date'),
      active_token: tokenFromMailLink,
      date_registr: date_registr => expect(date_registr).to.be.a('date'),
      email: req.body.email,
      letter: true,
      password: password => expect(password).to.be.bcryptHashFor('letmein'),
      roles: [ 'volunteer' ],
      username: req.body.username
    });
  });

  it('refuses a forbidden return URL', async () => {

    const req = {
      ...baseRequest,
      body: {
        ...baseRequest.body,
        return_url: 'http://foo.bar/baz'
      }
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    await expectNoSideEffects(app);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        {
          location: 'body',
          path: '/return_url',
          message: 'Return URL is not allowed',
          validation: 'forbiddenReturnUrl'
        }
      ])
      .and.to.matchResponseDocumentation();
  });

  it('refuses invalid data', async () => {

    const req = {
      ...baseRequest,
      body: {
        email: 'foo',
        password: 'bar',
        username: 'b',
        letter: 'foo'
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidBody: true });

    const res = await testHttpRequest(app, req);

    await expectNoSideEffects(app);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        emailFormatError(),
        minLengthError({
          property: 'password',
          limit: 6
        }),
        minLengthError({
          property: 'username',
          limit: 2
        }),
        missingPropertyError({
          property: 'return_url'
        }),
        typeError({
          property: 'letter',
          type: 'boolean'
        })
      ])
      .and.to.matchResponseDocumentation();
  });

  it('registers the user account even if the confirmation email cannot be sent', async () => {

    // Make the send mail mock fail.
    sendMailMock.onFirstCall().rejects(new Error('oops'));

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(500)
      .and.to.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/500',
        title: 'Server Error',
        status: 500,
        detail: 'An unexpected error occurred'
      })
      .and.to.matchResponseDocumentation();

    const { mail } = await expectSideEffects(app, {
      databaseChanges: { users: 1 },
      // The mock has still received the email to send even though it returned a
      // rejected promise.
      mailSent: {
        subject: `Smapshot: ${__('auth.confirmAccount.emailTitle')}`,
        to: 'john.doe@localhost.localdomain'
      }
    });

    const tokenFromMailLink = expectLinkWithTokenInHtml('http://localhost:1337/example', mail.html);

    await expectUserInDatabase({
      active: false,
      active_expires: active_expires => expect(active_expires).to.be.a('date'),
      active_token: tokenFromMailLink,
      date_registr: date_registr => expect(date_registr).to.be.a('date'),
      email: req.body.email,
      password: password => expect(password).to.be.bcryptHashFor('letmein'),
      roles: [ 'volunteer' ],
      username: req.body.username
    });
  });

  describe('with a user in the database', () => {

    let existingUser;
    let initialState;
    beforeEach(async () => {
      existingUser = await createUser();
      initialState = await loadInitialState();
    });

    it('refuses to create a user with the same email', async () => {

      const req = {
        ...baseRequest,
        body: {
          ...baseRequest.body,
          email: existingUser.email
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      await expectNoSideEffects(app, initialState);

      expect(res)
        .to.have.status(422)
        .and.to.have.requestBodyValidationErrors(
          [
            uniqueError({
              property: 'email',
              message: 'email must be unique'
            })
          ],
          // This error has a custom detail message different than the standard
          // validation error message.
          { detail: ensureTranslation('auth.error.emailAlreadyExists') }
        )
        .and.to.matchResponseDocumentation();
    });
  });
});

function expectLinkWithTokenInHtml(baseUrl, html) {

  const firstUrlMatch = /<a[^>]href=['"]([^'"]+token[^'"]+)['"]/.exec(html);
  expect(firstUrlMatch, `found no <a> with an "href" containing a "token" query parameter:\n\n${html}`).not.to.equal(null);

  const decodedHref = decodeHtml(firstUrlMatch[1], {
    isAttributeValue: true
  });

  const decodedUrl = new URL(decodedHref);
  expect(decodedUrl).to.be.sameUrlAs(baseUrl, { search: false });

  // Make sure there is only the one expected query parameter.
  const queryParamNames = Array.from(decodedUrl.searchParams.keys());
  expect(queryParamNames).to.deep.equal([ 'token' ]);

  return decodedUrl.searchParams.get('token');
}
