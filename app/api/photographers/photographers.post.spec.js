const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /photographers', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase(); 

    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'POST',
      path: '/photographers',
      body: {}
    });
  });


  it('does not authorize a guest to post photographers', async () => {
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
       body: {
        last_name: 'Colin'
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


  it('does not authorize a volunteer to post photographers', async () => {
    const volunteer1 = await createUser({ roles: [ 'volunteer' ] });
    const tokenownervolunteer1 = await generateJwtFor(volunteer1);
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${tokenownervolunteer1}`
      }, body: {
        last_name: 'Colin'
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


  it('post a new photographer', async () => {

    const ownerAdmin1 = await createUser({ roles: [ 'owner_admin' ] });
    const tokenownerAdmin1 = await generateJwtFor(ownerAdmin1);
    const body = {
      first_name: "Marie",
      last_name: 'Colin',
      link: "https://resource.test.net/",
      company: "sari"
    }
    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${tokenownerAdmin1}`
      }, body
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(201)
      .and.to.have.jsonBody({
        ...body,
        id: 1,
      })
      .and.to.matchResponseDocumentation();

    //check if correctly inserted in DB
    const reqget = {
      method: 'GET',
      path: '/photographers',
      headers: {
        Authorization: `Bearer ${tokenownerAdmin1}`
      },
      query: {
        id: [1]
      }
    };

    expect(reqget).to.matchRequestDocumentation();
    
    const resget = await testHttpRequest(app, reqget);

    expect(resget)
      .to.have.status(200)
      .and.have.jsonBody([{
        id: 1,
        first_name: "Marie",
        last_name: 'Colin',
        link: "https://resource.test.net/",
        company: "sari",
        nImages: 0
      }])
      .and.to.matchResponseDocumentation();
  });
})
