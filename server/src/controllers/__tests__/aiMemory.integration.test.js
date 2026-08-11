import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import AiMemory from "../../models/AiMemory.js";
import AiMemoryPreference from "../../models/AiMemoryPreference.js";
import aiRoutes from "../../routes/ai.routes.js";
import { getAiMemoryContext } from "../../services/aiMemory.service.js";
import { deleteUser } from "../user.controller.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
  app.delete("/api/users/:id", protect, csrfProtection, deleteUser);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Explicit AI Memory pilot", () => {
  it("is owner-only, default-off and requires CSRF for consent", async () => {
    const { accessToken } = await createTestUser();

    const guest = await request(app).get("/api/ai/memory");
    expect(guest.status).toBe(401);

    const initial = await withAuth(
      request(app).get("/api/ai/memory"),
      accessToken,
    );
    expect(initial.status).toBe(200);
    expect(initial.body.data).toEqual({ enabled: false, entries: [] });

    const missingCsrf = await request(app)
      .put("/api/ai/memory/consent")
      .set("Cookie", [`accessToken=${accessToken}`])
      .send({ enabled: true });
    expect(missingCsrf.status).toBe(403);
  });

  it("versions corrections, isolates owners and stops writes when disabled", async () => {
    const first = await createTestUser();
    const second = await createTestUser();

    const enabled = await withAuth(
      request(app).put("/api/ai/memory/consent").send({ enabled: true }),
      first.accessToken,
    );
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.enabled).toBe(true);

    const created = await withAuth(
      request(app)
        .put("/api/ai/memory/response_style")
        .send({ value: "concise" }),
      first.accessToken,
    );
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      kind: "response_style",
      value: "concise",
      version: 1,
    });

    const corrected = await withAuth(
      request(app)
        .put("/api/ai/memory/response_style")
        .send({ value: "detailed" }),
      first.accessToken,
    );
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.version).toBe(2);

    const revisions = await AiMemory.find({ userId: first.user._id })
      .sort({ version: 1 })
      .lean();
    expect(revisions.map(({ status }) => status)).toEqual([
      "superseded",
      "active",
    ]);
    expect(revisions[1].supersedesMemoryId.toString()).toBe(
      revisions[0]._id.toString(),
    );

    const isolated = await withAuth(
      request(app).get("/api/ai/memory"),
      second.accessToken,
    );
    expect(isolated.body.data).toEqual({ enabled: false, entries: [] });

    await withAuth(
      request(app).put("/api/ai/memory/consent").send({ enabled: false }),
      first.accessToken,
    );
    const blocked = await withAuth(
      request(app)
        .put("/api/ai/memory/fitness_goal")
        .send({ value: "muscle_gain" }),
      first.accessToken,
    );
    expect(blocked.status).toBe(409);
  });

  it("validates enum-only values and supports export plus hard deletion", async () => {
    const { user, accessToken } = await createTestUser();
    await withAuth(
      request(app).put("/api/ai/memory/consent").send({ enabled: true }),
      accessToken,
    );

    const rejected = await withAuth(
      request(app)
        .put("/api/ai/memory/dietary_style")
        .send({ value: "I have an allergy and my OTP is 123456" }),
      accessToken,
    );
    expect(rejected.status).toBe(400);

    await withAuth(
      request(app)
        .put("/api/ai/memory/dietary_style")
        .send({ value: "vegetarian" }),
      accessToken,
    );
    const exported = await withAuth(
      request(app).get("/api/ai/memory/export"),
      accessToken,
    );
    expect(exported.status).toBe(200);
    expect(exported.body.data.entries).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain(
      "supersedesMemoryId",
    );

    const removed = await withAuth(
      request(app).delete("/api/ai/memory/dietary_style"),
      accessToken,
    );
    expect(removed.status).toBe(200);
    expect(await AiMemory.countDocuments({ userId: user._id })).toBe(0);

    await withAuth(request(app).delete("/api/ai/memory"), accessToken);
    expect(
      await AiMemoryPreference.countDocuments({ userId: user._id }),
    ).toBe(0);
  });

  it("declares one-active-memory and TTL indexes", () => {
    const indexes = AiMemory.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          { userId: 1, kind: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: "active" },
          }),
        ]),
        expect.arrayContaining([
          { expiresAt: 1 },
          expect.objectContaining({ expireAfterSeconds: 0 }),
        ]),
      ]),
    );
  });

  it("excludes expired entries before the asynchronous TTL monitor deletes them", async () => {
    const { user, accessToken } = await createTestUser();
    await withAuth(
      request(app).put("/api/ai/memory/consent").send({ enabled: true }),
      accessToken,
    );
    await withAuth(
      request(app)
        .put("/api/ai/memory/preferred_workout_time")
        .send({ value: "morning" }),
      accessToken,
    );
    await AiMemory.updateMany(
      { userId: user._id },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    );

    const state = await withAuth(
      request(app).get("/api/ai/memory"),
      accessToken,
    );
    const exported = await withAuth(
      request(app).get("/api/ai/memory/export"),
      accessToken,
    );

    expect(state.body.data).toEqual({ enabled: true, entries: [] });
    expect(exported.body.data).toEqual({ enabled: true, entries: [] });
    await expect(getAiMemoryContext(user._id)).resolves.toEqual([]);
  });

  it("joins the existing account deletion transaction", async () => {
    const owner = await createTestUser();
    const admin = await createTestUser({ role: "admin" });
    await withAuth(
      request(app).put("/api/ai/memory/consent").send({ enabled: true }),
      owner.accessToken,
    );
    await withAuth(
      request(app)
        .put("/api/ai/memory/training_environment")
        .send({ value: "gym" }),
      owner.accessToken,
    );

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );
    expect(response.status).toBe(200);
    expect(await AiMemory.countDocuments({ userId: owner.user._id })).toBe(0);
    expect(
      await AiMemoryPreference.countDocuments({ userId: owner.user._id }),
    ).toBe(0);
  });
});
