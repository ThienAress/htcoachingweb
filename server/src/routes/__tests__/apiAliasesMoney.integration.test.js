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
import orderRoutes from "../order.routes.js";
import contractRoutes from "../contract.routes.js";
import trainerSubscriptionRoutes from "../trainerSubscription.routes.js";
import fitnessPlusSubscriptionRoutes from "../fitnessPlusSubscription.routes.js";

// Các đường dẫn cũ của thao tác tiền và hợp đồng (PUT approve/cancel, POST /purchase) vẫn chạy làm bí danh của đường mới.
// Test chỉ dùng tài khoản không đủ quyền, mã không tồn tại hoặc dữ liệu sai để chứng minh hai đường đi qua CÙNG chuỗi
// xác thực, CSRF, phân quyền và kiểm tra dữ liệu mà không tạo hay đổi giao dịch nào.
let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/orders", orderRoutes);
  app.use("/api/contracts", contractRoutes);
  app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);
  app.use("/api/fitness-plus-subscriptions", fitnessPlusSubscriptionRoutes);
});
beforeEach(resetMetricsForTests);
afterEach(clearCollections);
afterAll(teardownTestDB);

const deprecatedHits = () => getMetricsSnapshot().counters["api.deprecated_route_hits"] || 0;
const MISSING_ID = "64b7f0f2f2f2f2f2f2f2f2f2";

// `actor`: tài khoản đủ quyền tới handler; `denied`: tài khoản bị chặn bởi phân quyền (nếu có).
const pairs = [
  {
    name: "order approval",
    fresh: ["post", `/api/orders/${MISSING_ID}/approve`],
    legacy: ["put", `/api/orders/${MISSING_ID}/approve`],
    actorRole: "admin",
    denied: true,
  },
  {
    name: "contract cancellation",
    fresh: ["post", `/api/contracts/${MISSING_ID}/cancel`],
    legacy: ["put", `/api/contracts/${MISSING_ID}/cancel`],
    actorRole: "admin",
    denied: true,
  },
  {
    name: "trainer plan purchase",
    fresh: ["post", "/api/trainer-subscriptions"],
    legacy: ["post", "/api/trainer-subscriptions/purchase"],
    actorRole: "user",
    denied: false,
  },
  {
    name: "HT Fitness+ purchase",
    fresh: ["post", "/api/fitness-plus-subscriptions"],
    legacy: ["post", "/api/fitness-plus-subscriptions/purchase"],
    actorRole: "user",
    denied: false,
  },
];

describe.each(pairs)("$name", ({ fresh, legacy, actorRole, denied }) => {
  const call = ([method, path], token) => {
    const base = request(app)[method](path).send({});
    return token ? withAuth(base, token) : base;
  };
  const slug = legacy[1].replace(/\W+/g, "-");

  it("requires a login on the new and the old path", async () => {
    const results = await Promise.all([call(fresh), call(legacy)]);

    expect(results.map((response) => response.status)).toEqual([401, 401]);
  });

  it("answers the old path exactly like the new one, and only the old one is marked and counted", async () => {
    const actor = await createTestUser({ email: `alias-actor-${slug}@example.com`, role: actorRole });

    const freshResponse = await call(fresh, actor.accessToken);
    expect(deprecatedHits()).toBe(0);
    const legacyResponse = await call(legacy, actor.accessToken);

    expect(legacyResponse.status).toBe(freshResponse.status);
    expect(legacyResponse.body.code).toBe(freshResponse.body.code);
    expect(legacyResponse.body.success).toBe(false);
    expect(freshResponse.headers.deprecation).toBeUndefined();
    expect(legacyResponse.headers.deprecation).toBe("true");
    expect(legacyResponse.headers.link).toContain(fresh[1].replace(MISSING_ID, ":id"));
    expect(deprecatedHits()).toBe(1);
  });

  it("rejects a request without the CSRF token the same way on both paths", async () => {
    const actor = await createTestUser({ email: `alias-csrf-${slug}@example.com`, role: actorRole });
    const withoutCsrf = ([method, path]) =>
      request(app)[method](path).set("Cookie", [`accessToken=${actor.accessToken}`]).send({});

    const [freshResponse, legacyResponse] = [await withoutCsrf(fresh), await withoutCsrf(legacy)];

    expect(legacyResponse.status).toBe(403);
    expect(legacyResponse.status).toBe(freshResponse.status);
    expect(legacyResponse.body.code).toBe(freshResponse.body.code);
    expect(deprecatedHits()).toBe(0);
  });

  if (denied) {
    it("does not count or mark a caller who lacks the permission", async () => {
      const customer = await createTestUser({ email: `alias-denied-${slug}@example.com`, role: "user" });

      const freshResponse = await call(fresh, customer.accessToken);
      const legacyResponse = await call(legacy, customer.accessToken);

      expect(freshResponse.status).toBe(403);
      expect(legacyResponse.status).toBe(403);
      expect(legacyResponse.headers.deprecation).toBeUndefined();
      expect(deprecatedHits()).toBe(0);
    });
  }
});
