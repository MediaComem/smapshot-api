const { sample } = require('lodash');

const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createCollection, updateCollectionBanner } = require('../../../spec/fixtures/collections');
const { getExpectedCollection } = require('../../../spec/expectations/collections');
const { enumError, typeError } = require('../../../spec/expectations/errors');
const { locales } = require('../../../spec/fixtures/i18n');
const { createImage } = require('../../../spec/fixtures/images');
const { createOwner } = require('../../../spec/fixtures/owners');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { generate } = require('../../../spec/utils/fixtures');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /collections', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/collections'
    });
  });

  it('retrieves an empty list of collections', async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody([])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('retrieves an empty list of collections if there are no images', async () => {
    await Promise.all([
      createCollection(),
      createCollection()
    ]);

    const initialState = await loadInitialState();

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody([])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it('does not accept invalid query parameters', async () => {

    const req = {
      ...baseRequest,
      query: {
        extra_info: 'foo',
        image_width: 42,
        is_challenge: '',
        is_main_challenge: 42,
        lang: 'foo',
        publish_state: [ 'bar' ],
        owner_id: [ 2, 'foo', 3.4 ]
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'query', property: 'extra_info', type: 'boolean' }),
        enumError({ location: 'query', property: 'image_width' }),
        typeError({ location: 'query', property: 'is_challenge', type: 'boolean' }),
        typeError({ location: 'query', property: 'is_main_challenge', type: 'boolean' }),
        enumError({ location: 'query', property: 'lang' }),
        enumError({ location: 'query', property: 'publish_state' }),
        typeError({ location: 'query', property: 'owner_id', type: 'integer', array: true })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('with default fixtures', () => {

    let owner1, owner2, owner3;
    let col1, col2, col3, col4, col5, col6;
    let initialState;
    beforeEach(async () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const threedaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const threeDaysAhead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      // Generate 5 collections belonging to 3 owners.
      [ owner1, owner2, owner3 ] = await generate(3, createOwner);
      [ col1, col2, col3, col4, col5, col6 ] = await Promise.all([
        createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 }),
        createCollection({ owner: owner1 }), // if no date_publi given, entry will be assigned todays date 
        createCollection({ date_publi: threedaysAgo, is_main_challenge: true, is_owner_challenge: true, owner: owner2 }),
        createCollection({ date_publi: oneYearAgo, owner: owner3 }),
        createCollection({ date_publi: null, owner: owner3 }),
        createCollection({ date_publi: threeDaysAhead, is_main_challenge: true, is_owner_challenge: true, owner: owner2 })
      ]);

      // Generate images for the collections.
      const images = await Promise.all([
        createImage({ collection: col1, state: 'initial' }),
        createImage({ collection: col1, state: 'waiting_validation' }),
        createImage({ collection: col2, state: 'validated' }),
        createImage({ collection: col2, state: 'initial' }),
        createImage({ collection: col2, state: 'waiting_validation' }),
        createImage({ collection: col2, state: 'validated' }),
        createImage({ collection: col3, state: 'validated' }),
        createImage({ collection: col3, state: 'waiting_validation' }),
        // Collection 4 has no georeferenced images.
        createImage({ collection: col4, state: 'initial' }),
        createImage({ collection: col4, state: 'initial' }),
        createImage({ collection: col5, state: 'initial' }),
        createImage({ collection: col6, state: 'initial' })
      ]);

      // Define banners for each collection.
      await Promise.all([ col1, col2, col3, col4 ].map(async col => {
        const banner = sample(images.filter(img => img.collection_id === col.id));
        await updateCollectionBanner(col, banner);
      }));

      initialState = await loadInitialState();
    });

    locales.forEach(locale => {
      it(`lists published collections in the "${locale}" locale`, async () => {
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
          .and.to.have.jsonBody([
            getExpectedCollection(col4, { locale, nImages: 2, nGeoref: 0 }),
            getExpectedCollection(col3, { locale, nImages: 2, nGeoref: 2 }),
            getExpectedCollection(col1, { locale, nImages: 2, nGeoref: 1 }),
            getExpectedCollection(col2, { locale, nImages: 4, nGeoref: 3 })
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    [
      { imageWidth: 200, expectedThumbnailsDirectory: 'thumbnails' },
      { imageWidth: 500, expectedThumbnailsDirectory: '500' },
      { imageWidth: 1024, expectedThumbnailsDirectory: '1024' },
    ].forEach(({ imageWidth, expectedThumbnailsDirectory }) => {
      it(`lists published collections with a ${imageWidth}-pixel wide thumbnail`, async () => {
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
          .and.to.have.jsonBody([
            getExpectedCollection(col4, { nImages: 2, nGeoref: 0, thumbnailsDirectory: expectedThumbnailsDirectory }),
            getExpectedCollection(col3, { nImages: 2, nGeoref: 2, thumbnailsDirectory: expectedThumbnailsDirectory }),
            getExpectedCollection(col1, { nImages: 2, nGeoref: 1, thumbnailsDirectory: expectedThumbnailsDirectory }),
            getExpectedCollection(col2, { nImages: 4, nGeoref: 3, thumbnailsDirectory: expectedThumbnailsDirectory })
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    it('selects collections belonging to one owner with the "owner_id" query parameter', async () => {
      const req = {
        ...baseRequest,
        query: {
          owner_id: owner2.id
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col3, { nImages: 2, nGeoref: 2 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects collections belonging to one of multiple owners with multiple "owner_id" query parameters', async () => {
      const req = {
        ...baseRequest,
        query: {
          owner_id: [ owner1.id, owner3.id ]
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col4, { nImages: 2, nGeoref: 0 }),
          getExpectedCollection(col1, { nImages: 2, nGeoref: 1 }),
          getExpectedCollection(col2, { nImages: 4, nGeoref: 3 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects collections marked as challenges by their owner with the "is_challenge" query parameter', async () => {
      const req = {
        ...baseRequest,
        query: {
          is_challenge: true
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col3, { nImages: 2, nGeoref: 2 }),
          getExpectedCollection(col1, { nImages: 2, nGeoref: 1 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('excludes collections marked as challenges by their owner with the "is_challenge" query parameter set to false', async () => {
      const req = {
        ...baseRequest,
        query: {
          is_challenge: false
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col4, { nImages: 2, nGeoref: 0 }),
          getExpectedCollection(col2, { nImages: 4, nGeoref: 3 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('selects the collection marked as the main challenge with the "is_main_challenge" query parameter', async () => {
      const req = {
        ...baseRequest,
        query: {
          is_main_challenge: true
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col3, { nImages: 2, nGeoref: 2 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('excludes the collection marked as the main challenge with the "is_main_challenge" query parameter set to false', async () => {
      const req = {
        ...baseRequest,
        query: {
          is_main_challenge: false
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedCollection(col4, { nImages: 2, nGeoref: 0 }),
          getExpectedCollection(col1, { nImages: 2, nGeoref: 1 }),
          getExpectedCollection(col2, { nImages: 4, nGeoref: 3 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    [
      {extra_info: false, options: { owner: false }}, // Expect the returned collections to contain no owner when extra_info false
      {extra_info: true, options: {}}
    ].forEach(({ extra_info, options }) => {
      // Expect extra information like the number of images only if the "extra_info" query parameter is sent.
      const extraInfoOptions = colOptions => extra_info ? ({ ...colOptions, ...options }) : options;
      const extraInfoOptionsNoMedia = colOptions => extra_info ? ({ ...colOptions, ...options, media: null }) : { ...options, media:null };

      it(`lists published collections by default if publish_state not defined and the "extra_info" query parameter set to ${extra_info}`, async () => {
        const req = {
          ...baseRequest,
          query: {
            extra_info: extra_info
          }
        };
        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedCollection(col4, extraInfoOptions({ nImages: 2, nGeoref: 0 })),
            getExpectedCollection(col3, extraInfoOptions({ nImages: 2, nGeoref: 2 })),
            getExpectedCollection(col1, extraInfoOptions({ nImages: 2, nGeoref: 1 })),
            getExpectedCollection(col2, extraInfoOptions({ nImages: 4, nGeoref: 3 }))
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it(`selects unpublished collections only as a super administrator with the "publish_state" query parameter set to "unpublished" and the "extra_info" query parameter set to ${extra_info}`, async () => {
        const admin = await createUser({ roles: [ 'super_admin' ] });
        const token = await generateJwtFor(admin);
        initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          },
          query: {
            extra_info: extra_info,
            publish_state: 'unpublished'
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);
        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedCollection(col6, extraInfoOptionsNoMedia( { nImages: 1, nGeoref: 0 })),
            getExpectedCollection(col5, extraInfoOptionsNoMedia( { nImages: 1, nGeoref: 0 }))
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it(`refuses to list unpublished collections as a guest with the "publish_state" query parameter set to "unpublished" and the "extra_info" query parameter set to ${extra_info}`, async () => {
        const req = {
          ...baseRequest,
          query: {
            extra_info: extra_info,
            publish_state: 'unpublished'
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
            detail: 'Unpublished collections can only be accessed by respective owner or super administrators'
          })
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it('selects published collections only with the "publish_state" query parameter set to "published"', async () => {
        const req = {
          ...baseRequest,
          query: {
            extra_info: extra_info,
            publish_state: 'published'
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedCollection(col4, extraInfoOptions({ nImages: 2, nGeoref: 0 })),
            getExpectedCollection(col3, extraInfoOptions({ nImages: 2, nGeoref: 2 })),
            getExpectedCollection(col1, extraInfoOptions({ nImages: 2, nGeoref: 1 })),
            getExpectedCollection(col2, extraInfoOptions({ nImages: 4, nGeoref: 3 }))
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it('lists all collections as a super administrator with the "publish_state" query parameter set to "all"', async () => {
        const admin = await createUser({ roles: [ 'super_admin' ] });
        const token = await generateJwtFor(admin);
        initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          },
          query: {
            extra_info: extra_info,
            publish_state: 'all'
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);
        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedCollection(col4, extraInfoOptions({ nImages: 2, nGeoref: 0 })),
            getExpectedCollection(col3, extraInfoOptions({ nImages: 2, nGeoref: 2 })),
            getExpectedCollection(col1, extraInfoOptions({ nImages: 2, nGeoref: 1 })),
            getExpectedCollection(col2, extraInfoOptions({ nImages: 4, nGeoref: 3 })),
            getExpectedCollection(col6, extraInfoOptionsNoMedia( { nImages: 1, nGeoref: 0 })),
            getExpectedCollection(col5, extraInfoOptionsNoMedia( { nImages: 1, nGeoref: 0 }))
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });


      it('lists all public collections + its own unpublished collections for owner_admin with "publish_state" query parameter set to "all"', async () => {
        const admin = await createUser({ roles: [ 'owner_admin' ], owner: owner3});
        const token = await generateJwtFor(admin);
        initialState = await loadInitialState();

        const req = {
          ...baseRequest,
          headers: {
            Authorization: `Bearer ${token}`
          },
          query: {
            extra_info: extra_info,
            publish_state: 'all'
          }
        };

        expect(req).to.matchRequestDocumentation();

        const res = await testHttpRequest(app, req);

        expect(res)
          .to.have.status(200)
          .and.to.have.jsonBody([
            getExpectedCollection(col4, extraInfoOptions({ nImages: 2, nGeoref: 0 })),
            getExpectedCollection(col3, extraInfoOptions({ nImages: 2, nGeoref: 2 })),
            getExpectedCollection(col1, extraInfoOptions({ nImages: 2, nGeoref: 1 })),
            getExpectedCollection(col2, extraInfoOptions({ nImages: 4, nGeoref: 3 })),
            getExpectedCollection(col5, extraInfoOptionsNoMedia( { nImages: 1, nGeoref: 0 }))
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });

      it('refuses to list all collections as a guest with the "publish_state" query parameter set to "all"', async () => {
        const req = {
          ...baseRequest,
          query: {
            extra_info: extra_info,
            publish_state: 'all'
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
            detail: 'Unpublished collections can only be accessed by respective owner or super administrators'
          })
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });
  });
});
