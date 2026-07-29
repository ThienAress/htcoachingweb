import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import {
  runReleaseBJournalMigration,
  verifyReleaseBJournalMigration,
} from "../../migrations/20260729-today-dashboard-release-b.js";
import DailyJournal from "../../models/DailyJournal.js";
import DailyJournalRevision from "../../models/DailyJournalRevision.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import opsRoutes from "../../routes/ops.routes.js";
import userRoutes from "../../routes/user.routes.js";
import {
  runDailyJournalRetentionSweep,
} from "../../services/dailyJournalPrivacy.service.js";
import {
  syncDailyJournalRetentionForClient,
} from "../../services/dailyJournalRetentionPolicy.service.js";
import { getVietnamDateKey } from "../../utils/dateKey.js";

let app;

const REQUEST_ID = "b6666666-6666-4666-8666-666666666666";

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: "privacy-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "privacy-client-" + suffix + "@example.com",
  });
  await Order.create({
    userId: client.user._id,
    trainerId: trainer.user._id,
    name: client.user.name,
    email: client.user.email,
    package: "PT",
    sessions: 5,
    totalSessions: 5,
    status: "approved",
  });
  return { client, trainer };
};

const createViaApi = (client, dateKey = getVietnamDateKey()) =>
  withAuth(
    request(app)
      .put("/api/daily-journals/" + dateKey)
      .send({
        expectedRevision: 0,
        requestId: REQUEST_ID,
        patch: {
          wellness: { energy: 7 },
          notes: { private: "Riêng tư", shared: "Chia sẻ với HLV" },
        },
      }),
    client.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use("/api/ops", opsRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
  delete process.env.TODAY_JOURNAL_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Daily Journal ownership and privacy", () => {
  it("rejects a calendar date that does not exist", async () => {
    const client = await createTestUser({
      email: "privacy-invalid-date@example.com",
    });

    const response = await withAuth(
      request(app).get("/api/daily-journals/2026-02-30"),
      client.accessToken,
    );

    expect(response.status).toBe(400);
  });

  it("allows assigned trainer read, redacts private note and blocks outsider", async () => {
    const { client, trainer } = await createAssigned("idor");
    const outsider = await createTestUser({
      email: "privacy-outsider@example.com",
      role: "trainer",
    });
    const dateKey = getVietnamDateKey();
    await createViaApi(client, dateKey);
    const path =
      "/api/daily-journals/trainer/clients/" +
      client.user._id +
      "/" +
      dateKey;

    const allowed = await withAuth(
      request(app).get(path),
      trainer.accessToken,
    );
    const denied = await withAuth(
      request(app).get(path),
      outsider.accessToken,
    );

    expect(allowed.status).toBe(200);
    expect(allowed.body.data.notes).toEqual({
      shared: "Chia sẻ với HLV",
    });
    expect(denied.status).toBe(403);
  });

  it("exports own data and deletes journals plus revisions transactionally", async () => {
    const { client } = await createAssigned("delete");
    await createViaApi(client);
    await DailyJournalRevision.create({
      journalId: new mongoose.Types.ObjectId(),
      clientId: client.user._id,
      revision: 1,
      actorId: client.user._id,
      actorRole: "user",
      action: "update",
      requestId: "c7777777-7777-4777-8777-777777777777",
      payloadFingerprint: "b".repeat(64),
      changes: [{ path: "wellness.energy", after: 6 }],
    });

    const exported = await withAuth(
      request(app).get("/api/daily-journals/privacy/export"),
      client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/daily-journals/privacy")
        .send({ confirmation: "DELETE_MY_DAILY_JOURNALS" }),
      client.accessToken,
    );

    expect(exported.status).toBe(200);
    expect(exported.body.data.journals).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain(
      "payloadFingerprint",
    );
    expect(deleted.body.data).toEqual({ journals: 1, revisions: 2 });
    expect(await DailyJournal.countDocuments()).toBe(0);
    expect(await DailyJournalRevision.countDocuments()).toBe(0);
  });

  it("keeps retention dry-run by default and enforces only explicit candidates", async () => {
    const { client, trainer } = await createAssigned("retention");
    const admin = await createTestUser({
      email: "privacy-retention-admin@example.com",
      role: "admin",
    });
    await Order.updateMany(
      { userId: client.user._id },
      {
        $set: {
          sessions: 0,
          sessionsExhaustedAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      },
    );
    const journal = await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2025-01-01",
      retentionExpiresAt: new Date(Date.now() - 60_000),
    });
    await DailyJournalRevision.create({
      journalId: journal._id,
      clientId: client.user._id,
      revision: 1,
      actorId: client.user._id,
      actorRole: "user",
      action: "update",
      requestId: REQUEST_ID,
      payloadFingerprint: "a".repeat(64),
      changes: [{ path: "wellness.energy", after: 5 }],
    });

    const dryRun = await runDailyJournalRetentionSweep();
    process.env.TODAY_JOURNAL_RETENTION_ENFORCE = "true";
    await expect(
      runDailyJournalRetentionSweep({
        enforce: true,
        actorId: trainer.user._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      codeName: "JOURNAL_RETENTION_ADMIN_REQUIRED",
    });
    const enforced = await runDailyJournalRetentionSweep({
      enforce: true,
      actorId: admin.user._id,
    });

    expect(dryRun).toEqual({
      dryRun: true,
      candidates: 1,
      deleted: 0,
    });
    expect(enforced.deleted).toBe(1);
    expect(await DailyJournal.countDocuments()).toBe(0);
    expect(await DailyJournalRevision.countDocuments()).toBe(0);
  });

  it("never deletes an expired journal while coaching is active", async () => {
    const { client, trainer } = await createAssigned("active-retention");
    const admin = await createTestUser({
      email: "privacy-active-retention-admin@example.com",
      role: "admin",
    });
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2025-01-03",
      retentionExpiresAt: new Date(Date.now() - 60_000),
    });
    process.env.TODAY_JOURNAL_RETENTION_ENFORCE = "true";

    const result = await runDailyJournalRetentionSweep({
      enforce: true,
      actorId: admin.user._id,
    });

    expect(result).toEqual({
      dryRun: false,
      candidates: 0,
      deleted: 0,
    });
    expect(await DailyJournal.countDocuments()).toBe(1);
  });

  it("keeps the ops retention route dry-run by default and gates enforcement", async () => {
    const admin = await createTestUser({
      email: "privacy-ops-admin@example.com",
      role: "admin",
    });
    const regular = await createTestUser({
      email: "privacy-ops-user@example.com",
    });
    await DailyJournal.create({
      clientId: regular.user._id,
      dateKey: "2025-01-02",
      retentionExpiresAt: new Date(Date.now() - 60_000),
    });

    const denied = await withAuth(
      request(app)
        .post("/api/ops/privacy/daily-journals/retention")
        .send({ enforce: false }),
      regular.accessToken,
    );
    const dryRun = await withAuth(
      request(app)
        .post("/api/ops/privacy/daily-journals/retention")
        .send({ enforce: false }),
      admin.accessToken,
    );
    const disabled = await withAuth(
      request(app)
        .post("/api/ops/privacy/daily-journals/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(denied.status).toBe(403);
    expect(dryRun.status).toBe(200);
    expect(dryRun.headers["cache-control"]).toBe("no-store");
    expect(dryRun.body.data).toEqual({
      dryRun: true,
      candidates: 1,
      deleted: 0,
    });
    expect(disabled.status).toBe(503);
    expect(disabled.body.code).toBe(
      "JOURNAL_RETENTION_ENFORCEMENT_DISABLED",
    );
    expect(await DailyJournal.countDocuments()).toBe(1);

    process.env.TODAY_JOURNAL_RETENTION_ENFORCE = "true";
    const enforced = await withAuth(
      request(app)
        .post("/api/ops/privacy/daily-journals/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(enforced.status).toBe(200);
    expect(enforced.body.data.deleted).toBe(1);
    expect(await DailyJournal.countDocuments()).toBe(0);
  });

  it("schedules retention from a canonical coaching end and clears it on renewal", async () => {
    const { client, trainer } = await createAssigned("policy");
    const journal = await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2026-07-20",
    });
    await Order.updateMany(
      { userId: client.user._id },
      {
        $set: {
          sessions: 0,
          sessionsExhaustedAt: new Date("2026-07-29T00:00:00.000Z"),
        },
      },
    );

    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: client.user._id,
      coachingEndedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    const retentionExpiresAt = (
      await DailyJournal.findById(journal._id)
    ).retentionExpiresAt;
    await Order.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      name: client.user.name,
      email: client.user.email,
      package: "Renewal",
      sessions: 5,
      totalSessions: 5,
      status: "approved",
    });
    const renewed = await syncDailyJournalRetentionForClient({
      clientId: client.user._id,
    });

    expect(scheduled.state).toBe("retention_scheduled");
    expect(retentionExpiresAt).toBeInstanceOf(Date);
    expect(renewed.state).toBe("active");
    expect(
      (await DailyJournal.findById(journal._id)).retentionExpiresAt,
    ).toBeNull();
  });

  it("creates and verifies indexes without backfilling documents", async () => {
    const result = await runReleaseBJournalMigration();
    const { client, trainer } = await createAssigned("unique");
    const data = {
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2026-07-29",
    };
    await DailyJournal.create(data);

    expect(result.createdIndexes).toBeGreaterThanOrEqual(2);
    expect(result.documentsModified).toBe(0);
    expect(result.verification.totalIssues).toBe(0);
    expect((await verifyReleaseBJournalMigration()).totalIssues).toBe(0);
    await expect(DailyJournal.create(data)).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("includes journals and revisions in admin user deletion inventory", async () => {
    const { client } = await createAssigned("admin-delete");
    const admin = await createTestUser({
      email: "privacy-admin-delete@example.com",
      role: "admin",
    });
    await createViaApi(client);

    const response = await withAuth(
      request(app).delete("/api/user/" + client.user._id),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(await User.findById(client.user._id)).toBeNull();
    expect(await DailyJournal.countDocuments()).toBe(0);
    expect(await DailyJournalRevision.countDocuments()).toBe(0);
  });
});
