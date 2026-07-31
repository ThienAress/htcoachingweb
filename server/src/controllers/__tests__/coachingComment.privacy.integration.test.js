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
  runReleaseGCommentMigration,
  verifyReleaseGCommentMigration,
} from "../../migrations/20260729-today-dashboard-release-g.js";
import CoachingComment from "../../models/CoachingComment.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import DailyJournal from "../../models/DailyJournal.js";
import InAppNotification from "../../models/InAppNotification.js";
import Order from "../../models/Order.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import opsRoutes from "../../routes/ops.routes.js";
import userRoutes from "../../routes/user.routes.js";
import {
  runCoachingCommentRetentionSweep,
} from "../../services/coachingCommentPrivacy.service.js";
import {
  syncDailyJournalRetentionForClient,
} from "../../services/dailyJournalRetentionPolicy.service.js";
import { getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const REQUEST_ID = "89999999-9999-4999-8999-999999999999";

const createActive = async (suffix) => {
  const trainer = await createTestUser({
    email: "comment-privacy-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "comment-privacy-client-" + suffix + "@example.com",
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
  const journal = await DailyJournal.create({
    clientId: client.user._id,
    trainerIdAtCreation: trainer.user._id,
    dateKey: today,
    revision: 1,
  });
  return { client, trainer, journal };
};

const createComment = (data) =>
  withAuth(
    request(app).post("/api/coaching-comments").send({
      targetType: "daily_journal",
      targetId: data.journal._id,
      requestId: REQUEST_ID,
      body: "Nội dung privacy",
    }),
    data.client.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use("/api/ops", opsRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});
beforeEach(() => {
  process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.TODAY_COMMENT_WRITES_ENABLED;
  delete process.env.TODAY_COMMENT_RETENTION_ENFORCE;
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Coaching Comment privacy lifecycle", () => {
  it("exports own data and deletes comments/revisions transactionally", async () => {
    const data = await createActive("delete");
    await createComment(data);
    const exported = await withAuth(
      request(app).get("/api/coaching-comments/privacy/export"),
      data.client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/coaching-comments/privacy")
        .send({ confirmation: "DELETE_MY_COACHING_COMMENTS" }),
      data.client.accessToken,
    );

    expect(exported.status).toBe(200);
    expect(exported.body.data.comments).toHaveLength(1);
    expect(exported.body.data.revisions).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain("payloadFingerprint");
    expect(deleted.body.data).toEqual({ comments: 1, revisions: 1 });
    expect(await CoachingComment.countDocuments()).toBe(0);
  });

  it("cascades comment history and notification when its journal is hard-deleted", async () => {
    const data = await createActive("journal-cascade");
    await createComment(data);

    const deleted = await withAuth(
      request(app)
        .delete("/api/daily-journals/privacy")
        .send({ confirmation: "DELETE_MY_DAILY_JOURNALS" }),
      data.client.accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(await DailyJournal.countDocuments()).toBe(0);
    expect(await CoachingComment.countDocuments()).toBe(0);
    expect(await CoachingCommentRevision.countDocuments()).toBe(0);
    expect(await InAppNotification.countDocuments()).toBe(0);
  });

  it("joins coaching-end retention policy and clears deadlines on renewal", async () => {
    const data = await createActive("policy");
    const created = await createComment(data);
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
      coachingEndedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    expect(scheduled.state).toBe("retention_scheduled");
    expect(
      (await CoachingComment.findById(created.body.data._id)).retentionExpiresAt,
    ).toBeInstanceOf(Date);
    expect(
      (await InAppNotification.findOne({
        clientId: data.client.user._id,
      })).retentionExpiresAt,
    ).toBeInstanceOf(Date);

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
    expect(
      (await syncDailyJournalRetentionForClient({
        clientId: data.client.user._id,
      })).state,
    ).toBe("active");
    expect(
      (await CoachingComment.findById(created.body.data._id)).retentionExpiresAt,
    ).toBeNull();
    expect(
      (await InAppNotification.findOne({
        clientId: data.client.user._id,
      })).retentionExpiresAt,
    ).toBeNull();
  });

  it("double-checks active clients and gates retention enforcement", async () => {
    const data = await createActive("sweep");
    const admin = await createTestUser({
      email: "comment-privacy-admin@example.com",
      role: "admin",
    });
    const created = await createComment(data);
    await CoachingComment.updateOne(
      { _id: created.body.data._id },
      { $set: { retentionExpiresAt: new Date(Date.now() - 60_000) } },
    );
    process.env.TODAY_COMMENT_RETENTION_ENFORCE = "true";
    expect(
      await runCoachingCommentRetentionSweep({
        enforce: true,
        actorId: admin.user._id,
      }),
    ).toMatchObject({ candidates: 0, deleted: 0 });
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    delete process.env.TODAY_COMMENT_RETENTION_ENFORCE;
    const disabled = await withAuth(
      request(app)
        .post("/api/ops/privacy/coaching-comments/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );
    process.env.TODAY_COMMENT_RETENTION_ENFORCE = "true";
    const enforced = await withAuth(
      request(app)
        .post("/api/ops/privacy/coaching-comments/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(disabled.status).toBe(503);
    expect(enforced.body.data.deleted).toBe(1);
    expect(await CoachingCommentRevision.countDocuments()).toBe(0);
  });

  it("creates indexes without backfill and joins admin user deletion", async () => {
    const result = await runReleaseGCommentMigration();
    const data = await createActive("admin-delete");
    const admin = await createTestUser({
      email: "comment-delete-admin@example.com",
      role: "admin",
    });
    await createComment(data);
    const deleted = await withAuth(
      request(app).delete("/api/user/" + data.client.user._id),
      admin.accessToken,
    );

    expect(result.documentsModified).toBe(0);
    expect(result.verification.totalIssues).toBe(0);
    expect((await verifyReleaseGCommentMigration()).totalIssues).toBe(0);
    expect(deleted.status).toBe(200);
    expect(await CoachingComment.countDocuments()).toBe(0);
    expect(await CoachingCommentRevision.countDocuments()).toBe(0);
  });
});
