const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createImage } = require('../../../spec/fixtures/images');
const { getExpectedRequestedImageAttributes } = require('../../../spec/expectations/images');
const { missingPropertyError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { __ } = require('i18n');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createPhotographer } = require('../../../spec/fixtures/photographers');

const { ensureTranslation } = require('../../../spec/utils/i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('POST /images', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'POST',
      path: '/images',
    });
  });


  it('does not authorize a guest to post images', async () => {
    const initialState = await loadInitialState();

    const req = {
      ...baseRequest,
    };

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


  it('does not allow volunteer to post images', async () => {
    const volunteer = await createUser({ roles: [ 'volunteer' ] });
    const initialState = await loadInitialState();

    const token = await generateJwtFor(volunteer);

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

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
    let baseRequestOwner;
    let owner1, collection1, ownerAdmin1, tokenOwnerAdmin1;
    let photographer1, photographer2, photographerAnonym;

    let initialState;

    beforeEach(async () => {

      //creation of collection and owner 1
      owner1 = await createOwner();
      collection1 = await createCollection({ owner: owner1 });
      ownerAdmin1 = await createUser({ owner: owner1, roles: [ 'owner_admin' ] });
      tokenOwnerAdmin1 = await generateJwtFor(ownerAdmin1);

      //creation of photographers
      photographer1 = await createPhotographer();
      photographer2 = await createPhotographer();
      photographerAnonym = await createPhotographer({ last_name: 'Anonyme', first_name: null, company: null, link: null });

      //REQUEST
      baseRequestOwner = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${tokenOwnerAdmin1}`
        }, 
        body : {
          iiif_data: {
            image_service3_url: "https://www.e-rara.ch/zuz/i3f/v20/9380556"
          },
          is_published: true,
          original_id: "original_id_1",
          title: "TEST title",
          collection_id: collection1.id,
          view_type: "terrestrial",
          framing_mode: "single_image",
          license: "Zentralbibliothek Zürich",
          observation_enabled: true,
          correction_enabled: false,
          height: 200,
          width: 600,
          apriori_location: {
            longitude: 8.30999999,
            latitude: 47.19999999
          }
        }
      };
    });


    it('does not allow owner to post images in non existing collections', async () => {
      initialState = await loadInitialState();

      //not existing collection
      const req = {
        ...baseRequestOwner,
        body: {
          ...baseRequestOwner.body,
          collection_id: 20
        }
      };
  
      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
  
      expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: ensureTranslation('general.resourceNotFound')
      })
      .and.to.matchResponseDocumentation();
  
      await expectNoSideEffects(app, initialState);
    });
  
  
    it('does not allow owner to post images in a collection which is not their', async () => {

      //creation of another collection with other owner
      const collection2 = await createCollection();

      initialState = await loadInitialState();

      const req = {
        ...baseRequestOwner,
        body: {
          ...baseRequestOwner.body,
          collection_id: collection2.id
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: ensureTranslation('general.resourceNotFound')
      })
      .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });


    it('do not allow to post already existing images', async () => {
      
      //create image in database
      await createImage({ collection: collection1, original_id: 'original_id_1' })

      initialState = await loadInitialState();

      const req = {
        ...baseRequestOwner
      };
  
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        {
          location: 'body', 
          path:"",
          message: ensureTranslation('images.submitted.originalIdAlreadyExist'),
          validation: "imageOriginalIdExist"
        }
      ])
      .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
    

    it('does not allow to post if photographer does not exist already', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequestOwner,
        body: {
          ...baseRequestOwner.body,
          photographer_ids: [100]
        }
      };

      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);
  
      expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        {
          location: 'body', 
          path:"",
          message: ensureTranslation('images.submitted.photographerDoesNotExist'),
          validation: "imagePhotographerDoesNotExist"
        }
      ])
      .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });


    it('control mandatory fields', async () => {
      initialState = await loadInitialState();

      const req = {
        ...baseRequestOwner,
        body: {
          original_id: "original_id_1",
          collection_id: 1
        }
      };

      expect(req).to.matchRequestDocumentation({ invalidBody: true });
  
      const res = await testHttpRequest(app, req);
  
      expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        missingPropertyError({
          property: 'iiif_data'
        }),
        missingPropertyError({
          property: 'is_published'
        }),
        missingPropertyError({
          property: 'title'
        }),
        missingPropertyError({
          property: 'view_type'
        }),
        missingPropertyError({
          property: 'license'
        }),
        missingPropertyError({
          property: 'observation_enabled'
        }),
        missingPropertyError({
          property: 'correction_enabled'
        }),
        missingPropertyError({
          property: 'height'
        }),
        missingPropertyError({
          property: 'width'
        }),
        missingPropertyError({
          property: 'apriori_location'
        })
      ])
      .and.to.matchResponseDocumentation();
      
      await expectNoSideEffects(app, initialState);
    });


    it('post image with minimum requested attributes', async () => {

      const req = {
        ...baseRequestOwner
      };

      expect(req).to.matchRequestDocumentation();
  
      const res = await testHttpRequest(app, req);

      expect(res)
      .to.have.status(201)
      .and.to.matchResponseDocumentation();

      //Build expected answer
      delete res.body['date_inserted']; //avoid checking because of slight time differences (synchronization)

      const resJsonbody = {
        ...baseRequestOwner.body,
        id: 1,
        owner_id: 1,
        state: 'initial',
        iiif_data: {
          image_service3_url:"https://www.e-rara.ch/zuz/i3f/v20/9380556"
        },
        original_state: 'initial',
        exact_date: false,
        date_orig: "Null",
        downloaded: false,
        viewshed_created: false, 
        geotag_created: false,
        orig_title: "TEST title",
        apriori_location: {
          geom: {
            crs: { type: 'name', properties: { name: 'EPSG:4326' } },
            type: "Point",
            coordinates: [
              8.30999999,
              47.19999999,
              1000
            ]
          },
          azimuth: null,
          exact: false
        }
      };
      resJsonbody.photographers = [photographerAnonym];

      expect(res)
      .to.have.jsonBody(resJsonbody);

      //check if correctly inserted in DB
      const reqget = {
        method: 'GET',
        path: `/images/${res.body.id}/attributes`
      };

      expect(reqget).to.matchRequestDocumentation();
      
      const resget = await testHttpRequest(app, reqget);

      expect(resget)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedRequestedImageAttributes(req, 
            { id: res.body.id, owner: owner1, collection: collection1, photographers: [photographerAnonym] })
        )
        .and.to.matchResponseDocumentation();
    });


    it('post image with full attributes', async () => {

      const requestOwner = {
        ...baseRequest,
        headers: {
           ...baseRequestOwner.headers,
        },
        body: {
          ...baseRequestOwner.body,
          iiif_data: {
            image_service3_url: "https://www.e-rara.ch/zuz/i3f/v20/9380556",
            regionByPx: [20,10,100,190]
          },
          caption: "test caption",
          download_link: "https://www.e-rara.ch/zuz/i3f/v20/9380556",
          link: "https://www.e-rara.ch/zuz/i3f/v20/9380556",
          shop_link: "https://www.e-rara.ch/zuz/i3f/v20/9380556",
          view_type: "terrestrial",
          date_orig: "21e",
          date_shot: null,
          date_shot_min: "2021-11-29",
          date_shot_max: "2021-11-30",
          apriori_location: {
            longitude: 8.30999999,
            latitude: 47.19999999,
            altitude: 300.0,
            azimuth: 142.7,
            exact: true
          },
          photographer_ids: [photographer1.id, photographer2.id]
        }
      };
      
      const req = {
        ...requestOwner
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
      .to.have.status(201)
      .and.to.matchResponseDocumentation();

      //Build expected answer
      delete res.body['date_inserted']; //avoid checking because of slight time differences (synchronization)

      const resJsonbody = {
        ...requestOwner.body,
        id: 1,
        owner_id: 1,
        state: 'waiting_alignment',
        original_state: 'waiting_alignment',
        exact_date: false,
        downloaded: false,
        viewshed_created: false, 
        geotag_created: false,
        orig_title: "TEST title",
        orig_caption: "test caption",
        apriori_altitude: 300.0,
        apriori_location: {
          geom: {
            crs: { type: 'name', properties: { name: 'EPSG:4326' } },
            type: "Point",
            coordinates: [
              8.30999999,
              47.19999999,
              300.0
            ]
          },
          azimuth: 142.7,
          exact: true
        }
      };
      resJsonbody.photographers = [photographer1, photographer2];
      delete resJsonbody['date_shot'];
      delete resJsonbody['photographer_ids'];

      expect(res)
      .to.have.jsonBody(resJsonbody)

      //check if correctly inserted in DB
      const reqget = {
        method: 'GET',
        path: `/images/${res.body.id}/attributes`
      };

      expect(reqget).to.matchRequestDocumentation();
      
      const resget = await testHttpRequest(app, reqget);

      expect(resget)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedRequestedImageAttributes(requestOwner, 
            { id: res.body.id, owner: owner1, collection: collection1, photographers: [photographer1, photographer2] })
        )
        .and.to.matchResponseDocumentation();
    });
  });
})
