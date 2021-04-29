const { sample } = require('lodash');

const { expectNoSideEffects, loadInitialState } = require('../../../spec/expectations/side-effects');
const { createOwner, updateOwnerBanner } = require('../../../spec/fixtures/owners');
const { getExpectedOwner } = require('../../../spec/expectations/owners');
const { createCollection } = require('../../../spec/fixtures/collections');
const { createImage } = require('../../../spec/fixtures/images');
const { createUser, generateJwtFor } = require('../../../spec/fixtures/users');
const { enumError, typeError } = require('../../../spec/expectations/errors');
const { locales } = require('../../../spec/fixtures/i18n');
const { freeze, testHttpRequest } = require('../../../spec/utils/api');
const { resetDatabase } = require('../../../spec/utils/db');
const { setUpGlobalHooks } = require('../../../spec/utils/hooks');
const { expect } = require('../../../spec/utils/chai');
const { createApplicationWithMocks } = require('../../../spec/utils/mocks');

// This should be in every integration test file.
setUpGlobalHooks();

describe('GET /owners', () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: 'GET',
      path: '/owners'
    });
  });

  it('retrieves an empty list of owners', async () => {
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

  it('retrieves an empty list of owners if there are no collections', async () => {
    await Promise.all([
      createOwner(),
      createOwner()
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
        publish_state: [ 'bar' ],
        id: 'foo',
        image_width: 100
      }
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: 'query', property: 'id', type: 'integer', array: true }),
        enumError({ location: 'query', property: 'publish_state' }),
        enumError({ location: 'query', property: 'image_width' })
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe('with default fixtures', () => {

    let owner1, owner2, owner3, owner4;
    let col1, col2, col3, col4, col5;
    let initialState;
    beforeEach(async () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Generate 5 collections belonging to 3 owners.
      owner1 = await createOwner({ is_published: true });
      owner2 = await createOwner({ is_published: true });
      owner3 = await createOwner({ is_published: false});
      owner4 = await createOwner({ is_published: true});
      [ col1, col2, col3, col4, col5 ] = await Promise.all([
        createCollection({ date_publi: yesterday, is_owner_challenge: true, owner: owner1 }),
        createCollection({ owner: owner1 }),
        createCollection({ date_publi: threeMonthsAgo, is_main_challenge: true, is_owner_challenge: true, owner: owner2 }),
        createCollection({ date_publi: oneYearAgo, owner: owner3 }),
        createCollection({ date_publi: null, owner: owner3 })
      ]);

      // Generate images for the collections.
      const images = await Promise.all([
        createImage({ collection: col1, state: 'initial' }),
        createImage({ collection: col1, state: 'waiting_validation' }),
        createImage({ collection: col2, state: 'validated' }),
        createImage({ collection: col2, state: 'initial', is_published: false }),
        createImage({ collection: col2, state: 'waiting_validation' }),
        createImage({ collection: col2, state: 'validated' }),
        createImage({ collection: col3, state: 'validated' }),
        createImage({ collection: col3, state: 'waiting_validation' }),
        // Collection 4 has no georeferenced images.
        createImage({ collection: col4, state: 'initial' }),
        createImage({ collection: col4, state: 'initial' }),
        createImage({ collection: col5, state: 'initial' })
      ]);

      // Define banners for each owner.
      await Promise.all([ owner1, owner2, owner3 ].map(async owner => {
        const banner = sample(images.filter(img => img.owner_id === owner.id));
        await updateOwnerBanner(owner, banner);
      }));

      initialState = await loadInitialState();
    });

    it('lists published owners by default', async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedOwner(owner1, { n_images: 5, n_collections: 2 }),
          getExpectedOwner(owner2, { n_images: 2, n_collections: 1 }),
          getExpectedOwner(owner4, { n_images: 0, n_collections: 0, media: null })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    locales.forEach(locale => {
      it(`lists published owners in the "${locale}" locale`, async () => {
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
            getExpectedOwner(owner1, { locale, n_images: 5, n_collections: 2 }),
            getExpectedOwner(owner2, { locale, n_images: 2, n_collections: 1 }),
            getExpectedOwner(owner4, { locale, n_images: 0, n_collections: 0, media: null })
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
      it(`lists published owner with a ${imageWidth}-pixel wide thumbnail`, async () => {
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
            getExpectedOwner(owner1, { thumbnailsDirectory: expectedThumbnailsDirectory, n_images: 5, n_collections: 2 }),
            getExpectedOwner(owner2, { thumbnailsDirectory: expectedThumbnailsDirectory, n_images: 2, n_collections: 1 }),
            getExpectedOwner(owner4, { thumbnailsDirectory: expectedThumbnailsDirectory, n_images: 0, n_collections: 0, media: null })
          ])
          .and.to.matchResponseDocumentation();

        await expectNoSideEffects(app, initialState);
      });
    });

    it('lists published owners with publish_state `published`', async () => {

      const req = {
        ...baseRequest,
        query: {
          publish_state: 'published'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedOwner(owner1, { n_images: 5, n_collections: 2 }),
          getExpectedOwner(owner2, { n_images: 2, n_collections: 1 }),
          getExpectedOwner(owner4, { n_images: 0, n_collections: 0, media: null })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('lists unpublished owners as a super administrator with publish_state "unpublished"', async () => {
      const admin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(admin);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        },
        query: {
          publish_state: 'unpublished'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedOwner(owner3, { n_images: 3, n_collections: 1 })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('refuses to list unpublished owners as a guest', async () => {
      const req = {
        ...baseRequest,
        query: {
          publish_state: 'unpublished'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(403)
        .and.to.have.httpProblemDetailsBody({
          detail: 'Unpublished owners can only be accessed by super administrators',
          status: 403,
          title: 'Forbidden',
          type: 'https://httpstatuses.com/403'
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('lists all owners as a super administrator with publish_state "all"', async () => {
      const admin = await createUser({ roles: [ 'super_admin' ] });
      const token = await generateJwtFor(admin);
      initialState = await loadInitialState();

      const req = {
        ...baseRequest,
        headers: {
          Authorization: `Bearer ${token}`
        },
        query: {
          publish_state: 'all'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody([
          getExpectedOwner(owner1, { n_images: 5, n_collections: 2 }),
          getExpectedOwner(owner2, { n_images: 2, n_collections: 1 }),
          getExpectedOwner(owner3, { n_images: 3, n_collections: 1 }),
          getExpectedOwner(owner4, { n_images: 0, n_collections: 0, media: null })
        ])
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    it('refuses to list all owners as a guest with publish_state "all"', async () => {
      const req = {
        ...baseRequest,
        query: {
          publish_state: 'all'
        }
      };

      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(403)
        .and.to.have.httpProblemDetailsBody({
          detail: 'Unpublished owners can only be accessed by super administrators',
          status: 403,
          title: 'Forbidden',
          type: 'https://httpstatuses.com/403'
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });
  });
})
