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
import { errorHandler } from "../../middlewares/errorHandler.js";
import {
  runReleaseFWeeklyCheckinMigration,
  verifyReleaseFWeeklyCheckinMigration,
} from "../../migrations/20260729-today-dashboard-release-f.js";
import Order from "../../models/Order.js";
import CoachingComment from "../../models/CoachingComment.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import InAppNotification from "../../models/InAppNotification.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../../models/WeeklyCheckinRevision.js";
import opsRoutes from "../../routes/ops.routes.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import userRoutes from "../../routes/user.routes.js";
import weeklyCheckinRoutes from "../../routes/weeklyCheckin.routes.js";
import {
  syncDailyJournalRetentionForClient,
} from "../../services/dailyJournalRetentionPolicy.service.js";
import {
  runWeeklyCheckinRetentionSweep,
} from "../../services/weeklyCheckinPrivacy.service.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const weekStart = addDaysToDateKey(today, -getAppDayOfWeek(today));
const REQUEST_ID = "a9999999-9999-4999-8999-999999999999";

const createActive = async (suffix) => {
  const trainer = await createTestUser({
    email: `weekly-privacy-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `weekly-privacy-client-${suffix}@example.com`,
  });
  await Order.create({
    userId: client.user._id,
    trainerId: trainer.user._id,
    name: client.user.name,
    email: client.user.email,
    package: "PT",
    sessions: 3,
    totalSessions: 3,
    status: "approved",
  });
  return { client, trainer };
};

const createCheckin = (client) =>
  withAuth(
    request(app).put(`/api/weekly-checkins/${weekStart}`).send({
      expectedRevision: 0,
      requestId: REQUEST_ID,
      patch: { body: { weightKg: 70, energy: 8, note: "Privacy" } },
    }),
    client.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use("/api/weekly-checkins", weeklyCheckinRoutes);
  app.use("/api/ops", opsRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED = "true";
  process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED;
  delete process.env.TODAY_COMMENT_WRITES_ENABLED;
  delete process.env.TODAY_WEEKLY_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Weekly Check-in privacy lifecycle", () => {
  it("exports own check-ins/revisions and deletes both transactionally", async () => {
    const { client } = await createActive("delete");
    await createCheckin(client);
    const exported = await withAuth(
      request(app).get("/api/weekly-checkins/privacy/export"),
      client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/weekly-checkins/privacy")
        .send({ confirmation: "DELETE_MY_WEEKLY_CHECKINS" }),
      client.accessToken,
    );

    expect(exported.status).toBe(200);
    expect(exported.body.data.checkins).toHaveLength(1);
    expect(exported.body.data.revisions).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain("payloadFingerprint");
    expect(deleted.body.data).toEqual({ checkins: 1, revisions: 1 });
    expect(await WeeklyCheckin.countDocuments()).toBe(0);
  });

  it("cascades its contextual comment history on privacy hard-delete", async () => {
    const data = await createActive("comment-cascade");
    const created = await createCheckin(data.client);
    const comment = await withAuth(
      request(app).post("/api/coaching-comments").send({
        targetType: "weekly_checkin",
        targetId: created.body.data._id,
        requestId: "a8888888-8888-4888-8888-888888888888",
        body: "Weekly comment privacy",
      }),
      data.client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/weekly-checkins/privacy")
        .send({ confirmation: "DELETE_MY_WEEKLY_CHECKINS" }),
      data.client.accessToken,
    );

    expect(comment.status).toBe(201);
    expect(deleted.status).toBe(200);
    expect(await CoachingComment.countDocuments()).toBe(0);
    expect(await CoachingCommentRevision.countDocuments()).toBe(0);
    expect(await InAppNotification.countDocuments()).toBe(0);
  });

  it("schedules retention on coaching end and clears it on renewal", async () => {
    const data = await createActive("policy");
    const created = await createCheckin(data.client);
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
      coachingEndedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    const retained = await WeeklyCheckin.findById(created.body.data._id);
    await Order.create({
      userId: data.client.user._id,
      trainerId: data.trainer.user._id,
      name: data.client.user.name,
      email: data.client.user.email,
      package: "Renewal",
      sessions: 3,
      totalSessions: 3,
      status: "approved",
    });
    const renewed = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
    });

    expect(scheduled.state).toBe("retention_scheduled");
    expect(retained.retentionExpiresAt).toBeInstanceOf(Date);
    expect(renewed.state).toBe("active");
    expect(
      (await WeeklyCheckin.findById(created.body.data._id)).retentionExpiresAt,
    ).toBeNull();
  });

  it("protects active clients and gates retention enforcement", async () => {
    const data = await createActive("retention");
    const admin = await createTestUser({
      email: "weekly-privacy-admin@example.com",
      role: "admin",
    });
    const created = await createCheckin(data.client);
    await WeeklyCheckin.updateOne(
      { _id: created.body.data._id },
      { $set: { retentionExpiresAt: new Date(Date.now() - 60_000) } },
    );
    process.env.TODAY_WEEKLY_RETENTION_ENFORCE = "true";
    const protectedResult = await runWeeklyCheckinRetentionSweep({
      enforce: true,
      actorId: admin.user._id,
    });
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    delete process.env.TODAY_WEEKLY_RETENTION_ENFORCE;
    const disabled = await withAuth(
      request(app)
        .post("/api/ops/privacy/weekly-checkins/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );
    process.env.TODAY_WEEKLY_RETENTION_ENFORCE = "true";
    const enforced = await withAuth(
      request(app)
        .post("/api/ops/privacy/weekly-checkins/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(protectedResult).toMatchObject({ candidates: 0, deleted: 0 });
    expect(disabled.status).toBe(503);
    expect(enforced.body.data.deleted).toBe(1);
    expect(await WeeklyCheckinRevision.countDocuments()).toBe(0);
  });

  it("creates indexes without backfill and joins admin user deletion inventory", async () => {
    const result = await runReleaseFWeeklyCheckinMigration();
    const data = await createActive("admin-delete");
    const admin = await createTestUser({
      email: "weekly-delete-admin@example.com",
      role: "admin",
    });
    await createCheckin(data.client);
    const deleted = await withAuth(
      request(app).delete(`/api/user/${data.client.user._id}`),
      admin.accessToken,
    );

    expect(result.documentsModified).toBe(0);
    expect(result.verification.totalIssues).toBe(0);
    expect((await verifyReleaseFWeeklyCheckinMigration()).totalIssues).toBe(0);
    expect(deleted.status).toBe(200);
    expect(await WeeklyCheckin.countDocuments()).toBe(0);
    expect(await WeeklyCheckinRevision.countDocuments()).toBe(0);
  });
});
