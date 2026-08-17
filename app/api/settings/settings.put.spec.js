const { __ } = require("i18n");

const {
  expectNoSideEffects,
  loadInitialState,
} = require("../../../spec/expectations/side-effects");
const { createSetting } = require("../../../spec/fixtures/settings");
const { createUser, generateJwtFor } = require("../../../spec/fixtures/users");
const { testHttpRequest } = require("../../../spec/utils/api");
const { resetDatabase } = require("../../../spec/utils/db");
const { setUpGlobalHooks } = require("../../../spec/utils/hooks");
const { expect } = require("../../../spec/utils/chai");
const { createApplicationWithMocks } = require("../../../spec/utils/mocks");

// This should be in every integration test file.
setUpGlobalHooks();

describe("PUT /settings/:name", () => {
  let app;

  beforeEach(async () => {
    await resetDatabase();
    ({ app } = createApplicationWithMocks());
  });

  it("returns a 401 error when the user is not authenticated", async () => {
    await createSetting({ name: "maintenance_mode", value: false });
    const initialState = await loadInitialState();

    const req = {
      method: "PUT",
      path: "/settings/maintenance_mode",
      body: "{}",
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(401)
      .and.have.httpProblemDetailsBody({
        type: "https://httpstatuses.com/401",
        title: "Unauthorized",
        status: 401,
        detail: __("auth.error.generalServerAuth"),
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it("returns a 403 error when the user does not have the super_admin role", async () => {
    await createSetting({ name: "maintenance_mode", value: false });
    const user = await createUser({ roles: ["volunteer"] });
    const token = await generateJwtFor(user);
    const initialState = await loadInitialState();

    const req = {
      method: "PUT",
      path: "/settings/maintenance_mode",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(403)
      .and.have.httpProblemDetailsBody({
        type: "https://httpstatuses.com/403",
        title: "Forbidden",
        status: 403,
        detail: __("general.accessForbidden"),
      })
      .and.to.matchResponseDocumentation();

    await expectNoSideEffects(app, initialState);
  });

  it("returns a 404 error when the setting does not exist", async () => {
    const user = await createUser({ roles: ["super_admin"] });
    const token = await generateJwtFor(user);
    const initialState = await loadInitialState();

    const req = {
      method: "PUT",
      path: "/settings/unknown_setting",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
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

  it("updates the JSON object value of a setting", async () => {
    await createSetting({
      name: "maintenance_message",
      value: { de: "", en: "", fr: "", it: "", pt: "", ja: "" },
    });
    const user = await createUser({ roles: ["super_admin"] });
    const token = await generateJwtFor(user);

    const message = {
      de: "Wartungsmodus",
      en: "Maintenance mode",
      fr: "Mode maintenance",
      it: "Modalità di manutenzione",
      pt: "Modo de manutenção",
      ja: "メンテナンスモード",
    };

    const req = {
      method: "PUT",
      path: "/settings/maintenance_message",
      headers: { Authorization: `Bearer ${token}` },
      body: message,
    };

    expect(req).to.matchRequestDocumentation();

    const res = await testHttpRequest(app, req);

    expect(res)
      .to.have.status(200)
      .and.to.have.jsonBody(message)
      .and.to.matchResponseDocumentation();

    const getReq = {
      method: "GET",
      path: "/settings/maintenance_message",
    };

    const getRes = await testHttpRequest(app, getReq);

    expect(getRes).to.have.status(200).and.to.have.jsonBody(message);
  });
});
