import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { requestTelemetry } from "../../middlewares/requestTelemetry.js";
import opsRoutes from "../../routes/ops.routes.js";
import { resetMetricsForTests } from "../../observability/metrics.js";
import { PHASE4_INDEXES } from "../../migrations/20260719-phase4-index-performance.js";
import BlogPost from "../../models/BlogPost.js";
import Checkin from "../../models/Checkin.js";
import CoachingDay from "../../models/CoachingDay.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import Order from "../../models/Order.js";
import Recipe from "../../models/Recipe.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use(requestTelemetry);
  app.get("/api/ping", (_req, res) => res.json({ success: true }));
  app.use("/api/ops", opsRoutes);
});

afterEach(async () => {
  resetMetricsForTests();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 4 operational endpoints", () => {
  it("preserves valid request IDs and replaces unsafe values", async () => {
    const accepted = await request(app)
      .get("/api/ping")
      .set("X-Request-Id", "release-check-123");
    expect(accepted.status).toBe(200);
    expect(accepted.headers["x-request-id"]).toBe("release-check-123");

    const replaced = await request(app)
      .get("/api/ping")
      .set("X-Request-Id", "bad id");
    expect(replaced.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
  });

  it("reports readiness without authentication", async () => {
    const response = await request(app).get("/api/ops/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      service: "htcoaching-api",
      database: "ready",
    });
  });

  it("exposes metrics to admins only", async () => {
    const regular = await createTestUser({
      email: "phase4-user@example.com",
      role: "user",
    });
    const admin = await createTestUser({
      email: "phase4-admin@example.com",
      role: "admin",
    });

    const denied = await withAuth(
      request(app).get("/api/ops/metrics"),
      regular.accessToken,
    );
    expect(denied.status).toBe(403);

    const allowed = await withAuth(
      request(app).get("/api/ops/metrics"),
      admin.accessToken,
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers["cache-control"]).toBe("no-store");
    expect(allowed.body.data.counters["http.requests"]).toBeGreaterThan(0);
  });
});

describe("Phase 4 index declarations", () => {
  it("keeps every migration index represented by a model schema", () => {
    const modelsByCollection = new Map([
      [BlogPost.collection.name, BlogPost],
      [Order.collection.name, Order],
      [Checkin.collection.name, Checkin],
      [CoachingDay.collection.name, CoachingDay],
      [KnowledgeEntry.collection.name, KnowledgeEntry],
      [Recipe.collection.name, Recipe],
    ]);

    for (const [collectionName, expectedKey] of PHASE4_INDEXES) {
      const model = modelsByCollection.get(collectionName);
      expect(model, collectionName).toBeDefined();
      const declaredKeys = model.schema
        .indexes()
        .map(([key]) => JSON.stringify(key));
      expect(declaredKeys, `${collectionName} ${JSON.stringify(expectedKey)}`)
        .toContain(JSON.stringify(expectedKey));
    }
  });
});
