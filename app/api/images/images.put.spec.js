const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createImage } = require('../../../spec/fixtures/images');
const { getExpectedRequestedImageAttributes } = require('../../../spec/expectations/images');
const { typeError } = require('../../../spec/expectations/errors');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createPhotographer } = require('../../../spec/fixtures/photographers');
const { createCollection } = require('../../../spec/fixtures/collections');

// This should be in every integration test file.
setUpGlobalHooks();

describe('PUT /images/:id/attributes', () => {
  let app;
  let baseRequest;
  let collection1;
  let image, user1, token1;
  let initialState;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    collection1 = await createCollection();
    image = await createImage({ collection: collection1, date_georef: '2017-02-05'});
    user1 = await createUser({ roles: ['volunteer', 'owner_admin'], owner_id: 1 });
    token1 = await generateJwtFor(user1);

    initialState = await loadInitialState();

    baseRequest = freeze({
      method: 'PUT',
      path: `/images/${image.id}/attributes`,
      body:{}
    });
  });

  it('does not authorize a guest to update images', async () => {
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


  it('does not authorize owner_validator to update images', async () => {

    const user2 = await createUser({ owner_id: 1, roles: ['volunteer', 'owner_validator'] });
    const token2 = await generateJwtFor(user2);

    initialState = await loadInitialState();

    const req = {
      ...baseRequest,
      headers: {
        Authorization: `Bearer ${token2}`
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


  it('does not authorize to update image from other owner', async () => {
    
    const image2 = await createImage();
    initialState = await loadInitialState();

    const req = {
      method: 'PUT',
      path: `/images/${image2.id}/attributes`,
      headers: {
        Authorization: `Bearer ${token1}`
      },
      body: {}
    };

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


  it('does not accept invalid path parameters', async () => {

    const req = {
      method: 'PUT',
      path: '/images/foo/attributes',
      headers: {
        Authorization: `Bearer ${token1}`
      },
      body: {}
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'id' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });


  it('does not authorize to update georeferenced image', async () => {

    const req = {
      method: 'PUT',
      path: `/images/${image.id}/attributes`,
      headers: {
        Authorization: `Bearer ${token1}`
      },
      body: {
        width: 1000,
        height: 1000
      }
    };

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(422)
      .and.to.have.requestBodyValidationErrors([
        {
          location: 'body', 
          path:"",
          message: 'Image already georeferenced, iiif link or dimensions can\'t be changed.',
          validation: 'DimensionsAndIIIFUnmodifiables'
        }
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });


  it('correctly updates image attributes', async () => {

    //new image to update
    const imageToUpdate = await createImage({ collection: collection1 });
    const photographer1 = await createPhotographer();
    const photographer2 = await createPhotographer();

    const attributesToUpdate = {
      iiif_data: {
        image_service3_url:"updated",
        regionByPx: [300,200,2500,1500]
      },
      is_published: false,
      title: "updated",
      caption: "updated",
      license: "updated",
      download_link: "updated",
      link: "updated",
      shop_link: "updated",
      observation_enabled: true,
      correction_enabled: true,
      view_type: "lowOblique",
      height: 3010,
      width: 2010,
      date_orig: "updated",
      date_shot: "2022-01-04",
      date_shot_min: null,
      date_shot_max: null,
      apriori_location: {
        longitude: 100,
        latitude: 100,
        altitude: 1000,
        azimuth: 1,
        exact: false
      },
      photographer_ids: [
        photographer1.id, photographer2.id
      ]
    };

    const req = {
      method: 'PUT',
      path: `/images/${imageToUpdate.id}/attributes`,
      headers: {
        Authorization: `Bearer ${token1}`
      },
      body: {
        ...attributesToUpdate
      }
    };

    const res = await testHttpRequest(app, req);
    expect(res)
    .to.have.status(200)
    .and.have.jsonBody({
      message: "Image attributes have been updated."
    })
    .and.to.matchResponseDocumentation();

    //check if correctly inserted in DB
    const reqget = {
      method: 'GET',
      path: `/images/${imageToUpdate.id}/attributes`,
      headers: {
        Authorization: `Bearer ${token1}`
      }
    };

    expect(reqget).to.matchRequestDocumentation();
    
    const resget = await testHttpRequest(app, reqget);

    expect(resget)
      .to.have.status(200)
      .and.to.have.jsonBody(
        getExpectedRequestedImageAttributes(req, 
          { id: imageToUpdate.id, original_id: imageToUpdate.original_id, owner: imageToUpdate.owner, collection: collection1, photographers: [photographer1, photographer2], ...attributesToUpdate })
      )
      .and.to.matchResponseDocumentation();
  });
})

