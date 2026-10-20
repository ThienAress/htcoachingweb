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
  createTestUser({ email: `gifts-admin-${suffix}@example.com`, role: "admin" });

const saveGifts = (token, key, gifts) =>
  withAuth(request(app).put(`/api/site-settings/pricing-gifts/${key}`).send({ gifts }), token);

describe("pricing gifts settings", () => {
  it("serves no override by default so the page keeps its built-in gifts", async () => {
    const response = await request(app).get("/api/site-settings");

    expect(response.status).toBe(200);
    expect(response.body.data.pricingGifts).toEqual({});
  });

  it("lets an admin save a cleaned list for one plan and shows it to everyone", async () => {
    const admin = await createAdmin("save");
    const saved = await saveGifts(admin.accessToken, "1-1-vip", [
      "  Balo   Degrey ",
      "",
      "Shaker 600ml",
      "shaker 600ml",
    ]);

    expect(saved.status).toBe(200);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.pricingGifts).toEqual({
      "1-1-vip": ["Balo Degrey", "Shaker 600ml"],
    });
  });

  it("keeps an explicitly empty list, which means this plan has no gifts", async () => {
    const admin = await createAdmin("empty");
    await saveGifts(admin.accessToken, "online-basic", []);

    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.pricingGifts).toEqual({ "online-basic": [] });
  });

  it("restores the default by removing only that plan's override", async () => {
    const admin = await createAdmin("reset");
    await saveGifts(admin.accessToken, "1-1-basic", ["A"]);
    await saveGifts(admin.accessToken, "1-1-vip", ["B"]);

    const reset = await withAuth(
      request(app).delete("/api/site-settings/pricing-gifts/1-1-basic"),
      admin.accessToken,
    );

    expect(reset.status).toBe(200);
    const publicRead = await request(app).get("/api/site-settings");
    expect(publicRead.body.data.pricingGifts).toEqual({ "1-1-vip": ["B"] });
  });

  it("rejects unknown plan keys, bad lists and over-long gifts without writing", async () => {
    const admin = await createAdmin("invalid");

    const unknown = await saveGifts(admin.accessToken, "constructor", ["A"]);
    const notAList = await withAuth(
      request(app).put("/api/site-settings/pricing-gifts/trial").send({ gifts: "A" }),
      admin.accessToken,
    );
    const tooLong = await saveGifts(admin.accessToken, "trial", ["x".repeat(121)]);

    expect([unknown.status, notAList.status, tooLong.status]).toEqual([400, 400, 400]);
    const stored = await SiteSetting.findOne({ isSingleton: true }).lean();
    expect(Object.keys(stored?.pricingGifts || {})).toEqual([]);
  });

  it("blocks visitors and non-admin users from changing gifts", async () => {
    const visitor = await request(app)
      .put("/api/site-settings/pricing-gifts/trial")
      .send({ gifts: ["A"] });
    const customer = await createTestUser({ email: "gifts-customer@example.com" });
    const asCustomer = await saveGifts(customer.accessToken, "trial", ["A"]);

    expect(visitor.status).toBe(401);
    expect(asCustomer.status).toBe(403);
    expect(await SiteSetting.countDocuments({ "pricingGifts.trial": { $exists: true } })).toBe(0);
  });
});
