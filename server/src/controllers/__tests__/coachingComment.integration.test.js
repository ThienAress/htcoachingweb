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
import CoachingComment from "../../models/CoachingComment.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import AuditLog from "../../models/AuditLog.js";
import CoachingDay from "../../models/CoachingDay.js";
import DailyJournal from "../../models/DailyJournal.js";
import Order from "../../models/Order.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import {
  getAppDayOfWeek,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const range = getVietnamDayRangeUtc(today);
const IDS = {
  create: "81111111-1111-4111-8111-111111111111",
  replayConflict: "82222222-2222-4222-8222-222222222222",
  trainer: "83333333-3333-4333-8333-333333333333",
  edit: "84444444-4444-4444-8444-444444444444",
  remove: "85555555-5555-4555-8555-555555555555",
};

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: "comment-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "comment-client-" + suffix + "@example.com",
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

const createJournal = (data) =>
  DailyJournal.create({
    clientId: data.client.user._id,
    trainerIdAtCreation: data.trainer.user._id,
    dateKey: today,
    revision: 1,
  });

const createComment = (token, target, requestId = IDS.create, body = "Tuần này ổn") =>
  withAuth(
    request(app).post("/api/coaching-comments").send({
      targetType: target.type,
      targetId: target.id,
      requestId,
      body,
    }),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use(errorHandler);
  await Promise.all([CoachingComment.init(), CoachingCommentRevision.init()]);
});

beforeEach(() => {
  process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.TODAY_COMMENT_WRITES_ENABLED;
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Coaching Comment lifecycle", () => {
  it("creates idempotently, supports active trainer replies and blocks IDOR", async () => {
    const assigned = await createAssigned("thread");
    const outsider = await createAssigned("outsider");
    const journal = await createJournal(assigned);
    const target = { type: "daily_journal", id: journal._id };
    const created = await createComment(assigned.client.accessToken, target);
    const replay = await createComment(assigned.client.accessToken, target);
    const trainerReply = await createComment(
      assigned.trainer.accessToken,
      target,
      IDS.trainer,
      "HLV đã xem check-in",
    );
    const denied = await createComment(
      outsider.trainer.accessToken,
      target,
      IDS.replayConflict,
    );
    const listed = await withAuth(
      request(app).get(
        "/api/coaching-comments/daily_journal/" + journal._id,
      ),
      assigned.trainer.accessToken,
    );

    expect(created.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(trainerReply.status).toBe(201);
    expect(denied.status).toBe(403);
    expect(listed.body.data.items).toHaveLength(2);
    expect(await CoachingComment.countDocuments()).toBe(2);
    expect(
      await AuditLog.countDocuments({
        actorId: assigned.trainer.user._id,
        targetId: assigned.client.user._id,
      }),
    ).toBe(2);
  });

  it("edits only by author with revision and removes to an empty tombstone", async () => {
    const assigned = await createAssigned("revision");
    const journal = await createJournal(assigned);
    const target = { type: "daily_journal", id: journal._id };
    const created = await createComment(assigned.client.accessToken, target);
    const denied = await withAuth(
      request(app)
        .patch("/api/coaching-comments/" + created.body.data._id)
        .send({
          expectedRevision: 1,
          requestId: IDS.edit,
          body: "Trainer overwrite",
        }),
      assigned.trainer.accessToken,
    );
    const edited = await withAuth(
      request(app)
        .patch("/api/coaching-comments/" + created.body.data._id)
        .send({
          expectedRevision: 1,
          requestId: IDS.edit,
          body: "Nội dung đã sửa",
        }),
      assigned.client.accessToken,
    );
    const removed = await withAuth(
      request(app)
        .delete("/api/coaching-comments/" + created.body.data._id)
        .send({ expectedRevision: 2, requestId: IDS.remove }),
      assigned.client.accessToken,
    );

    expect(denied.status).toBe(403);
    expect(edited.body.data).toMatchObject({
      revision: 2,
      body: "Nội dung đã sửa",
    });
    expect(removed.body.data).toMatchObject({
      revision: 3,
      status: "removed",
      body: "",
    });
    expect(await CoachingComment.countDocuments()).toBe(1);
    expect(await CoachingCommentRevision.countDocuments()).toBe(3);
  });

  it("resolves all canonical targets server-side and revokes trainer access immediately", async () => {
    const assigned = await createAssigned("targets");
    const journal = await createJournal(assigned);
    const weekly = await WeeklyCheckin.create({
      clientId: assigned.client.user._id,
      trainerIdAtCreation: assigned.trainer.user._id,
      weekStartDateKey: today,
      status: "submitted",
      revision: 1,
    });
    weekly.weekStartDateKey = today;
    const coaching = await CoachingDay.create({
      userId: assigned.client.user._id,
      trainerId: assigned.trainer.user._id,
      dateString: today,
      date: range.start,
      title: "Coaching",
    });
    const workout = await WorkoutPlan.create({
      trainerId: assigned.trainer.user._id,
      clientId: assigned.client.user._id,
      clientName: assigned.client.user.name,
      title: "Workout",
      planDate: range.start,
      status: "published",
    });
    const targets = [
      ["daily_journal", journal._id],
      ["weekly_checkin", weekly._id],
      ["coaching_day", coaching._id],
      ["workout_plan", workout._id],
    ];
    for (const [index, [type, id]] of targets.entries()) {
      const response = await createComment(
        assigned.trainer.accessToken,
        { type, id },
        "86666666-6666-4666-8666-66666666666" + index,
      );
      expect(response.status).toBe(201);
    }
    await Order.updateMany(
      { userId: assigned.client.user._id },
      { $set: { sessions: 0 } },
    );
    const revoked = await withAuth(
      request(app).get(
        "/api/coaching-comments/daily_journal/" + journal._id,
      ),
      assigned.trainer.accessToken,
    );
    const own = await withAuth(
      request(app).get(
        "/api/coaching-comments/daily_journal/" + journal._id,
      ),
      assigned.client.accessToken,
    );

    expect(revoked.status).toBe(403);
    expect(own.status).toBe(200);
    expect(own.body.data.capabilities.canComment).toBe(false);
  });

  it("rejects HTML, URLs and reused request IDs with changed payload", async () => {
    const assigned = await createAssigned("content");
    const journal = await createJournal(assigned);
    const target = { type: "daily_journal", id: journal._id };
    await createComment(assigned.client.accessToken, target);
    const reused = await createComment(
      assigned.client.accessToken,
      target,
      IDS.create,
      "Khác payload",
    );
    const html = await createComment(
      assigned.client.accessToken,
      target,
      IDS.replayConflict,
      "<b>Không hợp lệ</b>",
    );

    expect(reused.status).toBe(409);
    expect(html.status).toBe(400);
  });
});
