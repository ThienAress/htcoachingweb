import mongoose from "mongoose";
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
import { errorHandler } from "../../middlewares/errorHandler.js";
import { rejectUnsafeMongoInput } from "../../middlewares/requestSanitization.js";
import { requestTelemetry } from "../../middlewares/requestTelemetry.js";
import { createSecurityHeaders } from "../../middlewares/securityHeaders.js";
import F1Customer from "../../models/F1Customer.js";
import F1DataDeletionJob from "../../models/F1DataDeletionJob.js";
import WebVitalSample from "../../models/WebVitalSample.js";
import {
  runPhase9Migration,
  verifyPhase9PrivacyOperations,
} from "../../migrations/20260720-phase9-privacy-operations.js";
import { resetMetricsForTests } from "../../observability/metrics.js";
import opsRoutes from "../../routes/ops.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use(requestTelemetry);
  app.use(
    ...createSecurityHeaders({
      isProduction: true,
      allowedOrigins: ["https://app.example.test"],
    }),
  );
  app.use(rejectUnsafeMongoInput);
  app.post("/api/echo", (req, res) => res.json({ data: req.body }));
  app.get("/api/ping", (_req, res) => res.json({ success: true }));
  app.use("/api/ops", opsRoutes);
  app.use(errorHandler);
});

afterEach(async () => {
  delete process.env.OPS_METRICS_TOKEN;
  delete process.env.CSP_ENFORCE;
  resetMetricsForTests();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 9 security and telemetry boundaries", () => {
  it("sets report-only CSP and propagates safe request and trace identifiers", async () => {
    const traceId = "0123456789abcdef0123456789abcdef";
    const response = await request(app)
      .get("/api/ping")
      .set("X-Request-Id", "phase9-request-001")
      .set("traceparent", "00-" + traceId + "-0123456789abcdef-01");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("phase9-request-001");
    expect(response.headers["x-trace-id"]).toBe(traceId);
    expect(response.headers["content-security-policy-report-only"]).toContain(
      "report-uri /api/ops/csp-report",
    );
    expect(response.headers["cross-origin-resource-policy"]).toBe(
      "cross-origin",
    );
  });

  it("rejects nested Mongo operators before they reach controllers", async () => {
    const response = await request(app)
      .post("/api/echo")
      .send({ profile: { $where: "sleep(1000)" } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("UNSAFE_REQUEST_KEY");
    expect(response.body.requestId).toBeTruthy();
  });

  it("accepts bounded RUM samples and normalizes identifiers and query strings", async () => {
    const accepted = await request(app)
      .post("/api/ops/web-vitals")
      .send({
        name: "LCP",
        value: 2100,
        route: "/f1-customers/507f1f77bcf86cd799439011?email=private@example.com",
        device: "mobile",
      });
    const rejected = await request(app)
      .post("/api/ops/web-vitals")
      .send({ name: "CLS", value: 99, route: "/", device: "desktop" });

    expect(accepted.status).toBe(202);
    expect(rejected.status).toBe(400);
    const sample = await WebVitalSample.findOne().lean();
    expect(sample.route).toBe("/f1-customers/:id");
    expect(sample.rating).toBe("good");
    expect(sample.expiresAt).toBeInstanceOf(Date);
  });

  it("supports a constant-time machine token for Prometheus without exposing JSON metrics", async () => {
    process.env.OPS_METRICS_TOKEN = "phase9-operations-token-123456";
    const prometheus = await request(app)
      .get("/api/ops/metrics/prometheus")
      .set("X-Ops-Token", process.env.OPS_METRICS_TOKEN);
    const jsonMetrics = await request(app)
      .get("/api/ops/metrics")
      .set("X-Ops-Token", process.env.OPS_METRICS_TOKEN);
    const alerts = await request(app)
      .get("/api/ops/alerts")
      .set("X-Ops-Token", process.env.OPS_METRICS_TOKEN);
    const unauthorizedAlerts = await request(app).get("/api/ops/alerts");

    expect(prometheus.status).toBe(200);
    expect(prometheus.text).toContain("htcoaching_http_requests");
    expect(jsonMetrics.status).toBe(401);
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.data)).toBe(true);
    expect(unauthorizedAlerts.status).toBe(401);
  });
});

describe("Phase 9 privacy operations", () => {
  it("keeps retention dry-run by default and exposes counts only to admins", async () => {
    const admin = await createTestUser({
      email: "phase9-admin@example.com",
      role: "admin",
    });
    await F1Customer.create({
      code: "F1-P9001",
      fullName: "Archived Client",
      age: 30,
      gender: "female",
      status: "archived",
      archivedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      retentionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdBy: admin.user._id,
    });

    const response = await withAuth(
      request(app)
        .post("/api/ops/privacy/f1/retention")
        .send({ enforce: false }),
      admin.accessToken,
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      dryRun: true,
      candidates: 1,
      queued: 0,
    });
    expect(await F1DataDeletionJob.countDocuments()).toBe(0);
  });

  it("backfills retention, audit roles and TTL indexes idempotently", async () => {
    const admin = await createTestUser({
      email: "phase9-migration@example.com",
      role: "admin",
    });
    const customer = await F1Customer.create({
      code: "F1-P9002",
      fullName: "Legacy Archived Client",
      age: 31,
      gender: "male",
      status: "new",
      createdBy: admin.user._id,
    });
    await F1Customer.collection.updateOne(
      { _id: customer._id },
      {
        $set: { status: "archived", archivedAt: new Date("2025-01-01") },
        $unset: { retentionExpiresAt: "" },
      },
    );
    await F1DataDeletionJob.collection.insertOne({
      customerId: customer._id,
      requestedBy: admin.user._id,
      reason: "admin_request",
      status: "completed",
      attempts: 1,
      nextAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await runPhase9Migration();
    const second = await runPhase9Migration();
    const archived = await F1Customer.findById(customer._id).lean();
    const deletionJob = await F1DataDeletionJob.findOne().lean();

    expect(first.verification.totalIssues).toBe(0);
    expect(second.verification.totalIssues).toBe(0);
    expect(second.migrated.retention).toBe(0);
    expect(archived.retentionExpiresAt).toBeInstanceOf(Date);
    expect(deletionJob.requestedByRole).toBe("admin");
    expect((await verifyPhase9PrivacyOperations()).totalIssues).toBe(0);
  });
});
