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
import CoachingDay from "../../models/CoachingDay.js";
import InAppNotification from "../../models/InAppNotification.js";
import Order from "../../models/Order.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import coachingRoutes from "../../routes/coaching.routes.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import workoutPlanRoutes from "../../routes/workoutPlan.routes.js";

let app;

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: "target-delete-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "target-delete-client-" + suffix + "@example.com",
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

const createComment = (trainer, targetType, targetId, requestId) =>
  withAuth(
    request(app).post("/api/coaching-comments").send({
      targetType,
      targetId,
      requestId,
      body: "Trao đổi phải được xóa cùng target",
    }),
    trainer.accessToken,
  );

const expectThreadDeleted = async () => {
  expect(await CoachingComment.countDocuments()).toBe(0);
  expect(await CoachingCommentRevision.countDocuments()).toBe(0);
  expect(await InAppNotification.countDocuments()).toBe(0);
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use("/api/coaching", coachingRoutes);
  app.use("/api/workout-plans", workoutPlanRoutes);
  app.use(errorHandler);
});
beforeEach(() => {
  process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.TODAY_COMMENT_WRITES_ENABLED;
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Coaching Comment target deletion cascade", () => {
  it("deletes the thread transactionally with a CoachingDay", async () => {
    const { client, trainer } = await createAssigned("coaching-day");
    const dateString = "2026-07-29";
    const target = await CoachingDay.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      dateString,
      date: new Date("2026-07-29T00:00:00.000Z"),
      title: "Strength",
      exercises: [],
    });
    expect(
      (await createComment(
        trainer,
        "coaching_day",
        target._id,
        "91111111-1111-4111-8111-111111111111",
      )).status,
    ).toBe(201);

    const deleted = await withAuth(
      request(app).delete(
        "/api/coaching/trainer/clients/" +
          client.user._id +
          "/" +
          dateString,
      ),
      trainer.accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(await CoachingDay.countDocuments()).toBe(0);
    await expectThreadDeleted();
  });

  it("deletes the thread transactionally with a WorkoutPlan", async () => {
    const { client, trainer } = await createAssigned("workout-plan");
    const target = await WorkoutPlan.create({
      trainerId: trainer.user._id,
      clientId: client.user._id,
      clientName: client.user.name,
      clientEmail: client.user.email,
      title: "Plan A",
      planDate: new Date("2026-07-29T00:00:00.000Z"),
      sections: [],
    });
    expect(
      (await createComment(
        trainer,
        "workout_plan",
        target._id,
        "92222222-2222-4222-8222-222222222222",
      )).status,
    ).toBe(201);

    const deleted = await withAuth(
      request(app).delete("/api/workout-plans/" + target._id),
      trainer.accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(await WorkoutPlan.countDocuments()).toBe(0);
    await expectThreadDeleted();
  });
});
