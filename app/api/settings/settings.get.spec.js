const { __ } = require("i18n");

const {
  expectNoSideEffects,
  loadInitialState,
} = require("../../../spec/expectations/side-effects");
const { createSetting } = require("../../../spec/fixtures/settings");
const { testHttpRequest } = require("../../../spec/utils/api");
const { resetDatabase } = require("../../../spec/utils/db");
const { setUpGlobalHooks } = require("../../../spec/utils/hooks");
const { expect } = require("../../../spec/utils/chai");
const { createApplicationWithMocks } = require("../../../spec/utils/mocks");

// This should be in every integration test file.
setUpGlobalHooks();

describe("GET /settings/:name", () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it("returns a 404 error when the setting does not exist", async () => {
    const initialState = await loadInitialState();

    const req = {
      method: "GET",
      path: "/settings/unknown_setting",
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(404)
      .and.have.httpProblemDetailsBody({
        type: "https://httpstatuses.com/404",
        title: "Not Found",
        status: 404,
        detail: __("general.resourceNotFound"),
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it("returns the boolean value of a setting", async () => {
    await createSetting({ name: "maintenance_mode", value: false });
    const initialState = await loadInitialState();

    const req = {
      method: "GET",
      path: "/settings/maintenance_mode",
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody(false)
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it("returns the JSON object value of a setting", async () => {
    const message = {
      de: "Wartungsmodus",
      en: "Maintenance mode",
      fr: "Mode maintenance",
      it: "Modalità di manutenzione",
      pt: "Modo de manutenção",
      ja: "メンテナンスモード",
    };
    await createSetting({ name: "maintenance_message", value: message });
    const initialState = await loadInitialState();

    const req = {
      method: "GET",
      path: "/settings/maintenance_message",
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody(message)
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });
});
