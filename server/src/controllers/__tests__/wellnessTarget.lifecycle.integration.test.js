import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
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
import {
  runWellnessTargetMigration,
  verifyWellnessTargetMigration,
} from "../../migrations/20260730-wellness-targets.js";
import Order from "../../models/Order.js";
import WellnessTarget from "../../models/WellnessTarget.js";
import wellnessTargetRoutes from "../../routes/wellnessTarget.routes.js";
import userRoutes from "../../routes/user.routes.js";
import { syncDailyJournalRetentionForClient } from "../../services/dailyJournalRetentionPolicy.service.js";
import { runWellnessTargetRetentionSweep } from "../../services/wellnessTargetPrivacy.service.js";

let app;
const targets = { sleepHours: 7.5, waterMl: 2500, steps: 8000 };
const requestId = (suffix) =>
  "40000000-0000-4000-8000-" + String(suffix).padStart(12, "0");

const createOrder = ({ clientId, trainerId }) =>
  Order.create({
    userId: clientId,
    trainerId,
    name: "Wellness lifecycle client",
    email: "wellness-lifecycle@example.com",
    package: "PT 10",
    sessions: 5,
    totalSessions: 10,
    status: "approved",
  });

const putTarget = (token, clientId, body) =>
  withAuth(
    request(app)
      .put("/api/wellness-targets/trainer/clients/" + clientId)
      .send(body),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/wellness-targets", wellnessTargetRoutes);
  app.use("/api/user", userRoutes);
  await Promise.all([Order.init(), WellnessTarget.init()]);
});

beforeEach(() => {
  process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED;
  delete process.env.TODAY_WELLNESS_TARGET_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Wellness target privacy lifecycle", () => {
  it("exports and deletes every version owned by the client", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(1),
      targets,
    });
    const exported = await withAuth(
      request(app).get("/api/wellness-targets/privacy/export"),
      client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/wellness-targets/privacy")
        .send({ confirmation: "DELETE_MY_WELLNESS_TARGETS" }),
      client.accessToken,
    );

    expect(exported.body.data.items).toHaveLength(1);
    expect(deleted.status).toBe(200);
    expect(await WellnessTarget.countDocuments({ clientId: client.user._id })).toBe(0);
  });

  it("schedules retention with coaching lifecycle and clears it on renewal", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    const created = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(2),
      targets,
    });
    await Order.updateMany({ userId: client.user._id }, { $set: { sessions: 0 } });
    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: client.user._id,
      coachingEndedAt: new Date("2026-07-30T00:00:00.000Z"),
    });
    const retained = await WellnessTarget.findById(created.body.data._id);
    const dryRun = await runWellnessTargetRetentionSweep({
      now: new Date("2030-01-01T00:00:00.000Z"),
      enforce: false,
    });
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    const renewed = await syncDailyJournalRetentionForClient({
      clientId: client.user._id,
    });

    expect(scheduled.state).toBe("retention_scheduled");
    expect(retained.retentionExpiresAt).toBeInstanceOf(Date);
    expect(dryRun).toMatchObject({ dryRun: true, candidates: 1, deleted: 0 });
    expect(renewed.state).toBe("active");
    expect(
      (await WellnessTarget.findById(created.body.data._id)).retentionExpiresAt,
    ).toBeNull();
  });

  it("enforces retention only with an admin actor after coaching ends", async () => {
    const admin = await createTestUser({ role: "admin" });
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    const created = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(3),
      targets,
    });
    await Order.updateMany({ userId: client.user._id }, { $set: { sessions: 0 } });
    await WellnessTarget.updateOne(
      { _id: created.body.data._id },
      { $set: { retentionExpiresAt: new Date("2026-01-01T00:00:00.000Z") } },
    );
    process.env.TODAY_WELLNESS_TARGET_RETENTION_ENFORCE = "true";

    const result = await runWellnessTargetRetentionSweep({
      now: new Date("2026-07-30T00:00:00.000Z"),
      enforce: true,
      actorId: admin.user._id,
    });

    expect(result).toMatchObject({ dryRun: false, candidates: 1, deleted: 1 });
    expect(await WellnessTarget.countDocuments()).toBe(0);
  });

  it("joins transactional admin user deletion", async () => {
    const admin = await createTestUser({ role: "admin" });
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(4),
      targets,
    });

    const deleted = await withAuth(
      request(app).delete("/api/user/" + client.user._id),
      admin.accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(await WellnessTarget.countDocuments()).toBe(0);
  });

  it("creates and verifies indexes without backfilling documents", async () => {
    const result = await runWellnessTargetMigration();
    const verification = await verifyWellnessTargetMigration();

    expect(result.documentsModified).toBe(0);
    expect(verification.totalIssues).toBe(0);
  });
});
