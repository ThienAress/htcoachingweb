import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  createTestApp,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import {
  markRuntimeDraining,
  resetRuntimeStateForTests,
} from "../../operations/runtimeState.js";
import opsRoutes from "../../routes/ops.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/ops", opsRoutes);
});

afterEach(() => {
  resetRuntimeStateForTests();
});

afterAll(async () => {
  resetRuntimeStateForTests();
  await teardownTestDB();
});

describe("Phase 10 production health lifecycle", () => {
  it("separates process liveness from database readiness", async () => {
    const live = await request(app).get("/api/ops/health/live");
    const ready = await request(app).get("/api/ops/health/ready");
    const compatibility = await request(app).get("/api/ops/health");

    expect(live.status).toBe(200);
    expect(live.body).toEqual(
      expect.objectContaining({
        success: true,
        lifecycle: "running",
      }),
    );
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual(
      expect.objectContaining({
        success: true,
        database: "ready",
        lifecycle: "ready",
      }),
    );
    expect(compatibility.status).toBe(200);
  });

  it("fails readiness while draining but keeps liveness available", async () => {
    markRuntimeDraining("SIGTERM");

    const ready = await request(app).get("/api/ops/health/ready");
    const live = await request(app).get("/api/ops/health/live");

    expect(ready.status).toBe(503);
    expect(ready.body).toEqual(
      expect.objectContaining({
        success: false,
        database: "ready",
        lifecycle: "draining",
      }),
    );
    expect(live.status).toBe(200);
    expect(live.body.lifecycle).toBe("draining");
    expect(ready.headers["cache-control"]).toBe("no-store");
  });
});
