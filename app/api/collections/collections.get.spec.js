const { getExpectedCollection } = require('../../../spec/expectations/collections');
const { typeError } = require('../../../spec/expectations/errors');
const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createCollection, updateCollectionBanner } = require('../../../spec/fixtures/collections');
const { locales } = require('../../../spec/fixtures/i18n');
const { createImage } = require('../../../spec/fixtures/images');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { ensureTranslation } = require('../../../spec/utils/i18n');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /collections/:id', () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it('does not accept invalid path parameters', async () => {
    const req = {
      method: 'GET',
      path: '/collections/foo'
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

  describe('with a collection that has no image and no banner', () => {
    let baseRequest;
    let collection;

    beforeEach(async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      collection = await createCollection({ date_publi: yesterday });

      baseRequest = freeze({
        method: 'GET',
        path: `/collections/${collection.id}`
      });
    });

    it('retrieves the collection', async () => {
      const initialState = await loadInitialState();

      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedCollection(collection, {
            media: {
              // FIXME: this should return a valid banner URL or none at all
              banner_url: `http://localhost:1337/data/collections/${collection.id}/images/500/.jpg`
            },
            nGeoref: 1,
            nImages: 1
          })
        )
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

  describe('with a collection that has images but no banner', () => {
    let baseRequest;
    let collection;

    beforeEach(async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      collection = await createCollection({ date_publi: yesterday });

      await Promise.all([
        createImage({ collection, state: 'initial' }),
        createImage({ collection, state: 'waiting_validation' }),
        createImage({ collection, state: 'validated' }),
        createImage({ collection, state: 'validated' })
      ]);

      baseRequest = freeze({
        method: 'GET',
        path: `/collections/${collection.id}`
      });
    });

    it('retrieves the collection', async () => {
      const initialState = await loadInitialState();

      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedCollection(collection, {
            media: {
              // FIXME: this should return a valid banner URL or none at all
              banner_url: `http://localhost:1337/data/collections/${collection.id}/images/500/.jpg`
            },
            nGeoref: 3,
            nImages: 4
          })
        )
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });

  describe('with a collection that has images and a banner', () => {
    let baseRequest;
    let collection;

    beforeEach(async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      collection = await createCollection({ date_publi: yesterday });

      // Generate images for the collections.
      const [ bannerImage ] = await Promise.all([
        createImage({ collection, state: 'initial' }),
        createImage({ collection, state: 'waiting_validation' }),
        createImage({ collection, state: 'validated' }),
        createImage({ collection, state: 'validated' })
      ]);

      // Assign the first image as the banner.
      await updateCollectionBanner(collection, bannerImage);

      baseRequest = freeze({
        method: 'GET',
        path: `/collections/${collection.id}`
      });
    });

    it('retrieves the collection', async () => {
      const initialState = await loadInitialState();

      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody(
          getExpectedCollection(collection, { nGeoref: 3, nImages: 4 })
        )
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    locales.forEach(locale => {
      it(`retrieves the collection in the "${locale}" locale`, async () => {
        const initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          query: {
            lang: locale
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody(
            getExpectedCollection(collection, { locale, nGeoref: 3, nImages: 4 })
          )
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    [
      { imageWidth: 200, expectedThumbnailsDirectory: 'thumbnails' },
      { imageWidth: 500, expectedThumbnailsDirectory: '500' },
      { imageWidth: 1024, expectedThumbnailsDirectory: '1024' },
    ].forEach(({ imageWidth, expectedThumbnailsDirectory }) => {
      it(`retrieves the collection with a ${imageWidth}-pixel wide thumbnail`, async () => {
        const initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          query: {
            image_width: imageWidth
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody(
            getExpectedCollection(collection, { nGeoref: 3, nImages: 4, thumbnailsDirectory: expectedThumbnailsDirectory })
          )
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    it('cannot retrieve an unknown collection', async () => {
      const initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        path: `/collections/${collection.id + 1000}`
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
  });
});
