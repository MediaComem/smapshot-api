const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner } = require('../../../spec/fixtures/owners');
const { getExpectedPhotographer } = require('../../../spec/expectations/photographers');
const { createPhotographer } = require('../../../spec/fixtures/photographers');
const { createImage } = require('../../../spec/fixtures/images');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { createCollection } = require('../../../spec/fixtures/collections');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /photographers', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();

    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/photographers'
    });
  });

  it('does not authorize a guest to retrieve photographers', async () => {
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

  it('does not authorize a volunteer to retrieve photographers', async () => {
    const volunteer1 = await createUser({ roles: [ 'volunteer' ] });
    const tokenownervolunteer1 = await generateJwtFor(volunteer1);
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${tokenownervolunteer1}`
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
    //initialisation
    let owner1, tokenOwnerAdmin1;
    let col1, ownerAdmin1;
    let photographer1, photographer2, photographer3 , photographer4, photographer5, photographer6;
    let photographerAnonym;
    let initialState;

    beforeEach(async () => {
      //creation of owners and collections
      owner1 = await createOwner();
      col1 = await createCollection({ owner: owner1 });
      
      //creation of users
      ownerAdmin1 = await createUser({ owner: owner1, roles: [ 'owner_admin' ] });
      tokenOwnerAdmin1 = await generateJwtFor(ownerAdmin1);
      
      //creation of photographers
      photographerAnonym = await createPhotographer({ first_name: null, last_name: 'Anonyme', link: null, company: null });
      photographer1 = await createPhotographer({  first_name: 'Jean-Marie-Jacques', last_name: 'Dupuis', company: 'sari' });
      photographer2 = await createPhotographer();
      photographer3 = await createPhotographer({  first_name: 'Marie', last_name: 'Colin', company: 'ethz' }); //no images
      photographer4 = await createPhotographer({  company: 'ethz' });
      photographer5 = await createPhotographer();
      photographer6 = await createPhotographer(); //no images
      
      //creation of images
      await createImage({ original_id: 'original_id1', collection: col1, photographers: [photographer1] });
      await createImage({ original_id: 'original_id2', collection: col1,  photographers: [photographer2] });
      await createImage({ original_id: 'original_id3',  photographers: [photographer4] });
      await createImage({ original_id: 'original_id4', photographers: [photographer4] });
      await createImage({ original_id: 'original_id5', collection: col1, photographers: [photographer5] });
      await createImage({ original_id: 'original_id6', collection: col1, photographers: [photographer5] });
      await createImage({ original_id: 'original_id7' }); //photographer anonym
      initialState = await loadInitialState();

    });
    ['owner_admin', 'super_admin'].forEach(roleAdmin => {
      it(`retrieve photographers for ${roleAdmin}`, async () => {

        const userAdmin = await createUser({ roles: [ roleAdmin ] });
        const tokenUserAdmin = await generateJwtFor(userAdmin);
        initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          headers: {
            Authorization: `Bearer ${tokenUserAdmin}`
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);
        expect(res)
          .to.have.status(200)
          .and.have.jsonBody([
            getExpectedPhotographer(photographer6, { nImages: 0 }),
            getExpectedPhotographer(photographer5, { nImages: 2 }),
            getExpectedPhotographer(photographer4, { nImages: 2 }),
            getExpectedPhotographer(photographer3, { nImages: 0 }),
            getExpectedPhotographer(photographer2, { nImages: 1 }),
            getExpectedPhotographer(photographer1, { nImages: 1 }),
            getExpectedPhotographer(photographerAnonym, { nImages: 1 })
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });


    it('retrieve list of photographers for specified ids ', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        },
        query: {
          id: [photographer1.id, photographer3.id, photographer5.id]
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedPhotographer(photographer5, { nImages: 2 }),
          getExpectedPhotographer(photographer3, { nImages: 0 }),
          getExpectedPhotographer(photographer1, { nImages: 1 }),
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });


    it('retrieve list of photographers for specified first_name ', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        },
        query: {
          first_name: 'Marie'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
          .and.have.jsonBody([
            getExpectedPhotographer(photographer3, { nImages: 0 }),
            getExpectedPhotographer(photographer1, { nImages: 1 }),
          ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });


    it('retrieve list of photographers for specified last_name ', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        },
        query: {
          last_name: ['dupuis']
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedPhotographer(photographer1, { nImages: 1 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    
    it('retrieve list of photographers for specified companies ', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        },
        query: {
          company: ['ethz', 'sari']
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedPhotographer(photographer4, { nImages: 2 }),
          getExpectedPhotographer(photographer3, { nImages: 0 }),
          getExpectedPhotographer(photographer1, { nImages: 1 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})
