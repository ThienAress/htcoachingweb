import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { getMetricsSnapshot, resetMetricsForTests } from "../../observability/metrics.js";
import trainingBookingRoutes from "../trainingBooking.routes.js";
import trainingBookingLegacyRoutes from "../trainingBookingLegacy.routes.js";
import mealplanAccessRoutes from "../mealplanAccess.routes.js";
import mealplanAccessLegacyRoutes from "../mealplanAccessLegacy.routes.js";

// Đường cũ được giữ làm bí danh của đường mới (.claude/rules/api-design.md): cùng kết quả, kèm header Deprecation và được đếm.
let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/training-bookings", trainingBookingRoutes);
  app.use("/api/training-booking", trainingBookingLegacyRoutes);
  app.use("/api/meal-plan-access", mealplanAccessRoutes);
  app.use("/api/mealplan-access", mealplanAccessLegacyRoutes);
});
beforeEach(resetMetricsForTests);
afterEach(clearCollections);
afterAll(teardownTestDB);

const deprecatedHits = () => getMetricsSnapshot().counters["api.deprecated_route_hits"] || 0;

describe("training booking aliases", () => {
  it("answers the old read paths like the new ones and marks them deprecated", async () => {
    const customer = await createTestUser({ email: "alias-booking@example.com" });
    const read = (path) => withAuth(request(app).get(path), customer.accessToken);

    const [fresh, legacy] = [await read("/api/training-bookings/me"), await read("/api/training-booking/my-booking")];

    expect(fresh.status).toBe(200);
    expect(legacy.status).toBe(200);
    expect(legacy.body).toEqual(fresh.body);
    expect(fresh.headers.deprecation).toBeUndefined();
    expect(legacy.headers.deprecation).toBe("true");
    expect(legacy.headers.link).toContain("/api/training-bookings/me");
    expect(deprecatedHits()).toBe(1);
  });

  it("serves the trainer lookup on both paths", async () => {
    const customer = await createTestUser({ email: "alias-trainer@example.com" });
    const read = (path) => withAuth(request(app).get(path), customer.accessToken);

    const [fresh, legacy] = [await read("/api/training-bookings/me/trainer"), await read("/api/training-booking/my-trainer")];

    expect(legacy.status).toBe(fresh.status);
    expect(legacy.body).toEqual(fresh.body);
  });

  it("still requires a login on both paths", async () => {
    const results = await Promise.all([
      request(app).get("/api/training-bookings/me"),
      request(app).get("/api/training-booking/my-booking"),
      request(app).post("/api/training-bookings").send({}),
      request(app).post("/api/training-booking/book").send({}),
    ]);

    expect(results.map((response) => response.status)).toEqual([401, 401, 401, 401]);
  });
});

describe("meal plan access aliases", () => {
  it("reads the same status on the old and the new path", async () => {
    const customer = await createTestUser({ email: "alias-mealplan@example.com", mealPlanGenerations: 0 });
    const read = (path) => withAuth(request(app).get(path), customer.accessToken);

    const [fresh, legacy] = [await read("/api/meal-plan-access"), await read("/api/mealplan-access/check")];

    expect(fresh.status).toBe(200);
    expect(legacy.body).toEqual(fresh.body);
    expect(legacy.headers.deprecation).toBe("true");
    expect(fresh.headers.deprecation).toBeUndefined();
  });

  it("counts a generation once whichever path the client used", async () => {
    const customer = await createTestUser({ email: "alias-usage@example.com", mealPlanGenerations: 0 });

    const viaLegacy = await withAuth(request(app).post("/api/mealplan-access/record"), customer.accessToken);
    const viaNew = await withAuth(request(app).post("/api/meal-plan-access/usages"), customer.accessToken);

    expect([viaLegacy.status, viaNew.status].every((status) => status === 200 || status === 403)).toBe(true);
    expect(viaLegacy.status).toBe(200);
    expect(viaLegacy.body.data.generationCount).toBe(1);
    if (viaNew.status === 200) expect(viaNew.body.data.generationCount).toBe(2);
    expect(viaLegacy.headers.deprecation).toBe("true");
    expect(viaNew.headers.deprecation).toBeUndefined();
  });

  it("still requires a login on both paths", async () => {
    const results = await Promise.all([
      request(app).get("/api/meal-plan-access"),
      request(app).get("/api/mealplan-access/check"),
    ]);

    expect(results.map((response) => response.status)).toEqual([401, 401]);
  });
});
