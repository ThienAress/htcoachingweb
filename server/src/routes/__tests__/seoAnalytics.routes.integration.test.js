import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { createSeoAnalyticsRouter } from "../seoAnalytics.routes.js";
import { AnalyticsSyncError } from "../../services/seoAnalyticsSync.service.js";

let app;
let adminToken;
let userToken;
let readService;
let syncService;

const overview = {
  range: { startDate: "2026-08-01", endDate: "2026-08-05" },
  kpis: { impressions: 100, clicks: 12, leads: 1 },
  providers: [{ provider: "ga4", health: "stale" }],
};

beforeAll(async () => {
  await setupTestDB();
});

beforeEach(async () => {
  const admin = await createTestUser({ role: "admin", email: "admin-analytics@example.com" });
  const user = await createTestUser({ role: "user", email: "user-analytics@example.com" });
  adminToken = admin.accessToken;
  userToken = user.accessToken;
  readService = {
    getOverview: vi.fn().mockResolvedValue(overview),
    getProviders: vi.fn().mockResolvedValue(overview.providers),
    getBlogPerformance: vi.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }),
    getKeywordPerformance: vi.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }),
    getBlogDetail: vi.fn().mockResolvedValue(null),
  };
  syncService = {
    syncProvider: vi.fn().mockResolvedValue({ provider: "ga4", status: "success", rowsWritten: 5 }),
  };
  app = createTestApp();
  app.use(
    "/api/admin/analytics",
    createSeoAnalyticsRouter({ readService, syncService }),
  );
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Admin SEO analytics routes", () => {
  it("returns 401 khi chưa đăng nhập", async () => {
    const response = await request(app).get(
      "/api/admin/analytics/overview?startDate=2026-08-01&endDate=2026-08-05",
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 cho non-admin", async () => {
    const response = await withAuth(
      request(app).get(
        "/api/admin/analytics/overview?startDate=2026-08-01&endDate=2026-08-05",
      ),
      userToken,
    );

    expect(response.status).toBe(403);
  });

  it("returns bounded overview DTO cho admin", async () => {
    const response = await withAuth(
      request(app).get(
        "/api/admin/analytics/overview?startDate=2026-08-01&endDate=2026-08-05",
      ),
      adminToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: overview });
  });

  it("reject invalid date range trước service", async () => {
    const response = await withAuth(
      request(app).get(
        "/api/admin/analytics/blog?startDate=2026-08-05&endDate=2026-08-01&page=1&limit=10",
      ),
      adminToken,
    );

    expect(response.status).toBe(400);
    expect(readService.getBlogPerformance).not.toHaveBeenCalled();
  });

  it("requires CSRF cho manual sync", async () => {
    const response = await request(app)
      .post("/api/admin/analytics/sync")
      .set("Cookie", [`accessToken=${adminToken}`])
      .send({
        provider: "ga4",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
      });

    expect(response.status).toBe(403);
    expect(syncService.syncProvider).not.toHaveBeenCalled();
  });

  it("runs manual sync cho admin với bounded body", async () => {
    const response = await withAuth(
      request(app).post("/api/admin/analytics/sync").send({
        provider: "ga4",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
      }),
      adminToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ provider: "ga4", rowsWritten: 5 });
  });

  it("returns 409 khi provider đang sync", async () => {
    syncService.syncProvider.mockRejectedValue(
      new AnalyticsSyncError("SYNC_IN_PROGRESS", "Provider đang được đồng bộ", "ga4"),
    );

    const response = await withAuth(
      request(app).post("/api/admin/analytics/sync").send({
        provider: "ga4",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
      }),
      adminToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SYNC_IN_PROGRESS");
  });

  it("returns 404 cho Blog detail không tồn tại", async () => {
    const response = await withAuth(
      request(app).get(
        "/api/admin/analytics/blog/missing-blog?startDate=2026-08-01&endDate=2026-08-05",
      ),
      adminToken,
    );

    expect(response.status).toBe(404);
  });
});
