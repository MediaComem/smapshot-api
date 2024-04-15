const { sample } = require("lodash");

const {
  expectNoSideEffects,
  loadInitialState,
} = require("../../../spec/expectations/side-effects");
const {
  enumError,
  typeError,
  minimumError,
} = require("../../../spec/expectations/errors");

const { freeze, testHttpRequest } = require("../../../spec/utils/api");

const { resetDatabase } = require("../../../spec/utils/db");

const { setUpGlobalHooks } = require("../../../spec/utils/hooks");

const { expect } = require("../../../spec/utils/chai");
const { createApplicationWithMocks } = require("../../../spec/utils/mocks");
const { generate } = require("../../../spec/utils/fixtures");
const { createNews } = require("../../../spec/fixtures/news");
const path = require("path");

// This should be in every integration test file.
setUpGlobalHooks();

describe("GET /news", () => {
  let app;
  let baseRequest;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());

    baseRequest = freeze({
      method: "GET",
      path: "/news",
    });
  });

  it("retrieves an empty list of news", async () => {
    const initialState = await loadInitialState();

    const req = baseRequest;
    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody({
        data: {
          news: [],
        },
        pagination: {
          total_records: 0,
          current_page: 1,
          page_size: 10,
          total_pages: 0,
          links: {
            prev_page: null,
            next_page: null,
          },
        },
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it("does not accept invalid type query parameters", async () => {
    const req = {
      ...baseRequest,
      query: {
        limit: "foo",
        offset: "bar",
      },
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        typeError({ location: "query", property: "limit", type: "integer" }),
        typeError({ location: "query", property: "offset", type: "integer" }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  it("does not accept negative offset", async () => {
    const req = {
      ...baseRequest,
      query: {
        offset: -1,
        limit: -1,
      },
    };

    expect(req).to.matchRequestDocumentation({ invalidParameters: true });

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(400)
      .and.to.have.requestParametersValidationErrors([
        minimumError({ location: "query", property: "offset", min: "0" }),
        minimumError({ location: "query", property: "limit", min: "0" }),
      ])
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app);
  });

  describe("with default fixtures", () => {
    let newsOneYearAgo, newsThreeMonthsAgo, newsYesterday;

    let initialState;
    beforeEach(async () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Generate 3 news
      [newsThreeMonthsAgo, newsOneYearAgo, newsYesterday] = await generate(
        3,
        createNews,
        [
          { created_at: threeMonthsAgo, img_url: "http://example.com/2" },
          { created_at: oneYearAgo },
          { created_at: yesterday },
        ]
      );

      initialState = await loadInitialState();
    });

    it("lists correctly ranking", async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          data: {
            news: [],
          },
          pagination: {
            total_records: 3,
            current_page: 1,
            page_size: 3,
            total_pages: 1,
            links: {
              prev_page: null,
              next_page: null,
            },
          },
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    });

    /* it("count all users correctly even if limit", async () => {
      const req = {
        ...baseRequest,
        query: {
          limit: "1",
        },
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          count: 3,
          rows: [
            {
              id: bob.id,
              username: bob.username,
              n_geoloc: 3,
              n_corr: 2,
              n_obs: 0,
            },
          ],
        })
        .and.to.matchResponseDocumentation();

      await expectNoSideEffects(app, initialState);
    }); */
  });
});
