
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { getExpectedObservation } = require('../../../spec/expectations/observations');
const { createObservation } = require('../../../spec/fixtures/observations');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { createOwner } = require('../../../spec/fixtures/owners');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { expect } = require('../../../spec/utils/chai');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { createCollection } = require('../../../spec/fixtures/collections');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /observations', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/observations'
    });
  });

  it('retrieves an empty list of observations', async () => {
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

  describe('with default fixtures', () => {
    //initialisation
    let volunteer1, ownerValidator1, ownerAdmin1;
    let owner1;
    let collection1;
    let observation1, observation2, observation3, observation4, observation5, observation6;
    let options;
    let initialState;

    beforeEach(async () => {
      
      //creation of collection
      owner1 = await createOwner();
      collection1 = await createCollection({ owner: owner1 });

      //creation of users
      volunteer1 = await createUser({ roles: [ 'volunteer' ] });
      ownerAdmin1 = await createUser({ owner: owner1, roles: [ 'owner_admin' ] });
      ownerValidator1 = await createUser({ owner: owner1, roles: [ 'owner_validator' ] });

      //creation of observations
      observation1 = await createObservation({ user: volunteer1, collection: collection1, state: 'validated' });
      observation2 = await createObservation({ user: volunteer1, state: 'rejected' });
      observation3 = await createObservation({ user: volunteer1, state: 'created' });
      observation4 = await createObservation({ collection: collection1, state: 'rejected' });
      observation5 = await createObservation({ state: 'validated' });
      observation6 = await createObservation({ collection: collection1, state: 'created' });

      initialState = await loadInitialState();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for super admin', async () => {
      //superadmin get unrestricted information (remark+validator) and all observations (all states)

      let superAdmin = await createUser({ roles: [ 'super_admin' ], first_name: 'super', last_name: 'admin', username: 'superadmin' });
      let tokenSuperAdmin = await generateJwtFor(superAdmin);
      initialState = await loadInitialState();
      
      options= {
        remark: true,
        validator: true
      };

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
          getExpectedObservation(observation6, options),
          getExpectedObservation(observation5, options),
          getExpectedObservation(observation4, options),
          getExpectedObservation(observation3, options),
          getExpectedObservation(observation2, options),
          getExpectedObservation(observation1, options)
          
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for super admin and specified owner_id', async () => {
      //superadmin get unrestricted information (remark+validator) and all observations (all states)

      let superAdmin = await createUser({ roles: [ 'super_admin' ], first_name: 'super', last_name: 'admin', username: 'superadmin' });
      let tokenSuperAdmin = await generateJwtFor(superAdmin);
      initialState = await loadInitialState();
      
      options= {
        remark: true,
        validator: true
      };

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenSuperAdmin}`
        },
        query: {
          owner_id: 1
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observation6, options),
          getExpectedObservation(observation4, options),
          getExpectedObservation(observation1, options)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for super admin and specified volunteer_id', async () => {
      //superadmin get unrestricted information (remark+validator) and all observations (all states)

      let superAdmin = await createUser({ roles: [ 'super_admin' ], first_name: 'super', last_name: 'admin', username: 'superadmin' });
      let tokenSuperAdmin = await generateJwtFor(superAdmin);
      initialState = await loadInitialState();
      
      options= {
        remark: true,
        validator: true
      };

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenSuperAdmin}`
        },
        query: {
          volunteer_id: 1
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observation3, options),
          getExpectedObservation(observation2, options),
          getExpectedObservation(observation1, options)
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it(`retrieve observations for owner admin`, async () => {
      //authenticated owner get their unrestricted observation and the unrestricted observations about their collection (all states,remark+validator), and restricted validated observations (no remark, no validator)
      
      let observationOwnerAdmin = await createObservation({ user: ownerAdmin1, state: 'created' });
      let tokenOwnerAdmin1 = await generateJwtFor(ownerAdmin1);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observationOwnerAdmin, options={ remark: true, validator: true }), // their observation
          getExpectedObservation(observation6, options={ remark: true, validator: true }), // observation from their collection: created  
          getExpectedObservation(observation5, options={ remark: false, validator: false }), // public observation validated   
          getExpectedObservation(observation4, options={ remark: true, validator: true }), // observation from their collection: rejected                           
          getExpectedObservation(observation1, options={ remark: true, validator: true }) // observation from their collection: validated
        ])
        .and.to.matchResponseDocumentation();
      
      await expectNoSideEffects(app, initialState);
    });

    it(`retrieve observations for owner validator`, async () => {
      //authenticated owner get their unrestricted observation and the unrestricted observations about their collection (all states,remark+validator), and restricted validated observations (no remark, no validator)
      
      let observationOwnerValidator = await createObservation({ user: ownerValidator1, state: 'validated' });
      let tokenOwnerValidator1 = await generateJwtFor(ownerValidator1);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerValidator1}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observationOwnerValidator, options={ remark: true, validator: true }), // their observation
          getExpectedObservation(observation6, options={ remark: true, validator: true }), // observation from their collection: created
          getExpectedObservation(observation5, options={ remark: false, validator: false }), // public observation validated            
          getExpectedObservation(observation4, options={ remark: true, validator: true }), // observation from their collection: rejected
          getExpectedObservation(observation1, options={ remark: true, validator: true }) // observation from their collection: validated
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it(`retrieve observations for owner validator for specified states`, async () => {

      let tokenOwnerValidator1 = await generateJwtFor(ownerValidator1);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerValidator1}`
        },
        query: {
          state: ['created', 'rejected']
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observation6, options={ remark: true, validator: true }), // observation from their collection: created
          getExpectedObservation(observation4, options={ remark: true, validator: true }) // observation from their collection: rejected
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for authenticated volunteer', async () => {
      //authenticated volunteer get their unrestricted observation (all states, remark+validator) and restricted validated observations (no remark, no validator)

      let tokenVolunteer1 = await generateJwtFor(volunteer1);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenVolunteer1}`
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observation5, options={ remark: false, validator: false }), //public observation validated
          getExpectedObservation(observation3, options={ remark: true, validator: true }), //their observation: created
          getExpectedObservation(observation2, options={ remark: true, validator: true }), //their observation: rejected
          getExpectedObservation(observation1, options={ remark: true, validator: true }) //their observation: validated
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for non authenticated user', async () => {
      //non authenticated user get restricted information and only validated observations (no remark, no validator)
      initialState = await loadInitialState();

      options= {
        remark: false,
        validator: false
      };

      const req = {
        ...baseRequest,
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.have.jsonBody([
          getExpectedObservation(observation5, options), //public validated observation
          getExpectedObservation(observation1, options) //public validated observation
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('retrieve observations for non authenticated user for specified states', async () => {

      initialState = await loadInitialState();

      options= {
        remark: false,
        validator: false
      };

      const req = {
        ...baseRequest,
        query: {
          state: ['created', 'rejected']
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
  });
});