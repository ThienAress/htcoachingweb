import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import SiteSetting from "../../models/SiteSetting.js";
import siteSettingRoutes from "../../routes/siteSetting.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/site-settings", siteSettingRoutes);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

const createAdmin = (suffix) =>
  createTestUser({ email: `content-admin-${suffix}@example.com`, role: "admin" });

const saveContent = (token, key, items) =>
  withAuth(request(app).put(`/api/site-settings/pricing-content/${key}`).send({ items }), token);

const savePromo = (token, body) =>
  withAuth(request(app).put("/api/site-settings/login-promo").send(body), token);

describe("pricing content settings", () => {
  it("serves nothing by default so the page keeps its built-in benefits", async () => {
    const response = await request(app).get("/api/site-settings");

    expect(response.body.data.pricingContent).toEqual({});
    expect(response.body.data.loginPromo).toEqual({ enabled: true, percent: 15 });
  });

  it("saves a cleaned benefit list for one tab and shows it to everyone", async () => {
    const admin = await createAdmin("save");
    const saved = await saveContent(admin.accessToken, "1-1-customer", [
      "  Tập 1 kèm 1 ",
      "",
      "Giáo án cá nhân hóa",
      "giáo án cá nhân hóa",
    ]);

    expect(saved.status).toBe(200);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.pricingContent).toEqual({
      "1-1-customer": ["Tập 1 kèm 1", "Giáo án cá nhân hóa"],
    });
  });

  it("restores only the chosen list", async () => {
    const admin = await createAdmin("reset");
    await saveContent(admin.accessToken, "online-customer", ["A"]);
    await saveContent(admin.accessToken, "online-system", ["B"]);

    const reset = await withAuth(
      request(app).delete("/api/site-settings/pricing-content/online-customer"),
      admin.accessToken,
    );

    expect(reset.status).toBe(200);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.pricingContent).toEqual({ "online-system": ["B"] });
  });

  it("rejects unknown keys, empty or oversized lists and over-long lines without writing", async () => {
    const admin = await createAdmin("invalid");

    const unknown = await saveContent(admin.accessToken, "constructor", ["A"]);
    const empty = await saveContent(admin.accessToken, "trial-system", ["  ", ""]);
    const tooMany = await saveContent(
      admin.accessToken,
      "trial-system",
      Array.from({ length: 13 }, (_, index) => `Quyền lợi ${index}`),
    );
    const tooLong = await saveContent(admin.accessToken, "trial-system", ["x".repeat(161)]);

    expect([unknown.status, empty.status, tooMany.status, tooLong.status]).toEqual([400, 400, 400, 400]);
    const stored = await SiteSetting.findOne({ isSingleton: true }).lean();
    expect(Object.keys(stored?.pricingContent || {})).toEqual([]);
  });

  it("blocks visitors and non-admin users", async () => {
    const visitor = await request(app)
      .put("/api/site-settings/pricing-content/trial-system")
      .send({ items: ["A"] });
    const customer = await createTestUser({ email: "content-customer@example.com" });
    const asCustomer = await saveContent(customer.accessToken, "trial-system", ["A"]);
    const promoAsCustomer = await savePromo(customer.accessToken, { enabled: false, percent: 10 });

    expect([visitor.status, asCustomer.status, promoAsCustomer.status]).toEqual([401, 403, 403]);
  });
});

describe("login promo settings", () => {
  it("lets an admin change the percentage and switch it off", async () => {
    const admin = await createAdmin("promo");

    const changed = await savePromo(admin.accessToken, { enabled: true, percent: 20 });
    expect(changed.status).toBe(200);
    let publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.loginPromo).toEqual({ enabled: true, percent: 20 });

    await savePromo(admin.accessToken, { enabled: false, percent: 20 });
    publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.loginPromo).toEqual({ enabled: false, percent: 20 });
  });

  it("restores the default of 15 percent", async () => {
    const admin = await createAdmin("promo-reset");
    await savePromo(admin.accessToken, { enabled: false, percent: 40 });

    const reset = await withAuth(request(app).delete("/api/site-settings/login-promo"), admin.accessToken);

    expect(reset.status).toBe(200);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.loginPromo).toEqual({ enabled: true, percent: 15 });
  });

  it("rejects non-integer, out-of-range and non-boolean values", async () => {
    const admin = await createAdmin("promo-invalid");

    const results = await Promise.all([
      savePromo(admin.accessToken, { enabled: true, percent: 0 }),
      savePromo(admin.accessToken, { enabled: true, percent: 101 }),
      savePromo(admin.accessToken, { enabled: true, percent: 12.5 }),
      savePromo(admin.accessToken, { enabled: true, percent: "15" }),
      savePromo(admin.accessToken, { enabled: "yes", percent: 15 }),
      savePromo(admin.accessToken, [1]),
    ]);

    expect(results.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400]);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.loginPromo).toEqual({ enabled: true, percent: 15 });
  });
});
