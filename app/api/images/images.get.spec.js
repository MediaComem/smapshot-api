const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createImage } = require('../../../spec/fixtures/images');
const { getExpectedImageAttributes } = require('../../../spec/expectations/images');
const { typeError } = require('../../../spec/expectations/errors');
const { testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');
const { __ } = require('i18n');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /images/:id/attributes', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const req = {
      method: 'GET',
      path: '/images/foo/attributes'
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: [ 'id' ] });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'path', property: 'id', type: 'integer' }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  it('returns not found for inexistant images', async () => {
    const req = {
      method: 'GET',
      path: '/images/100/attributes'
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: __('general.resourceNotFound')
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('initial image', () => {
    let image;
    let initialState;

    beforeEach(async () => {
      // Generate images for the collections.
      image = await createImage({ state: 'initial', apriori_longitude: 7.44, apriori_latitude: 46.95 });
      initialState = await loadInitialState();
    });

    it('retrieves the image', async () => {
      const req = {
        method: 'GET',
        path: `/images/${image.id}/attributes`
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedImageAttributes(image, { apriori_altitude: null,
                                              apriori_locations: [{
                                                exact: false,
                                                latitude: 46.95,
                                                longitude: 7.44,
                                                azimuth: null
                                              }],
                                              locked: false, locked_user_id: null, delta_last_start: null,

           })
        )
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})
