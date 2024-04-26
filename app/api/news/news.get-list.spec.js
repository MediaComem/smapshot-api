const { sample } = require("lodash");
const {
  expectNoSideEffects,
  loadInitialState,
} = require("../../../spec/expectations/side-effects");
const {
  typeError,
  minimumError,
} = require("../../../spec/expectations/errors");
const { freeze, testHttpRequest } = require("../../../spec/utils/api");
const { resetDatabase } = require("../../../spec/utils/db");
const { setUpGlobalHooks } = require("../../../spec/utils/hooks");
const { expect } = require("../../../spec/utils/chai");
const { createApplicationWithMocks } = require("../../../spec/utils/mocks");
const { createNews } = require("../../../spec/fixtures/news");
const { getExpectedNews } = require("../../../spec/expectations/news");
const config = require("../../../config");

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
    let newsOneYearAgo, newsThreeMonthsAgo, newsYesterday, newsTomorrow;
    const oneYearAgoDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const threeMonthsAgoDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let initialState;
    beforeEach(async () => {


      // Generate 3 news
      [newsThreeMonthsAgo, newsYesterday, newsOneYearAgo] = await Promise.all([
        createNews({
          published_at: threeMonthsAgoDate,
          img_url: "http://example.com/2",
        }),
        createNews({ published_at: yesterdayDate }),
        createNews({ published_at: oneYearAgoDate }),
        createNews({ published_at: tomorrowDate }),
      ]);

      initialState = await loadInitialState();
    });

    it("orders news by passed publication date", async () => {
      const req = baseRequest;
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);
      expect(res)
        .to.have.status(200)
        .and.to.have.jsonBody({
          data: {
            news: [
              getExpectedNews(newsYesterday),
              getExpectedNews(newsThreeMonthsAgo),
              getExpectedNews(newsOneYearAgo),
            ],
          },
          pagination: {
            total_records: 3,
            current_page: 1,
            page_size: 10,
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

    it("paginates correctly", async () => {
      const req = {
        method: "GET",
        path: "/news",
        query: {
          limit: 1,
          offset: 1,
        },
      };
      expect(req).to.matchRequestDocumentation();

      const res = await testHttpRequest(app, req);

      expect(res)
        .to.have.status(200)
        .and.to.matchResponseDocumentation();
        
      expect(res.body.pagination).to.eql({
          total_records: 3,
          current_page: 2,
          page_size: 1,
          total_pages: 3,
          links: {
            prev_page:
              config.apiUrl +
              "/news?offset=" +
              (req.query.offset - req.query.limit) +
              "&limit=" +
              req.query.limit,
            next_page:
              config.apiUrl +
              "/news?offset=" +
              (req.query.offset + req.query.limit) +
              "&limit=" +
              req.query.limit,
          },
      });

      await expectNoSideEffects(app, initialState);
    });
  });
});
