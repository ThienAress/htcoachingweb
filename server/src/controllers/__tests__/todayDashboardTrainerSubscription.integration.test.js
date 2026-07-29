import {
  afterAll,
  afterEach,
  beforeAll,
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
import DailyJournal from "../../models/DailyJournal.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import coachingHabitRoutes from "../../routes/coachingHabit.routes.js";
import progressRoutes from "../../routes/progress.routes.js";
import trainerClientOverviewRoutes from "../../routes/trainerClientOverview.routes.js";
import trainerOverviewRoutes from "../../routes/trainerOverview.routes.js";
import weeklyCheckinRoutes from "../../routes/weeklyCheckin.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const weekStart = addDaysToDateKey(today, -getAppDayOfWeek(today));

const seedSubscriptionTrainer = async (suffix) => {
  const trainer = await createTestUser({
    email: "subscription-trainer-" + suffix + "@example.com",
  });
  const client = await createTestUser({
    email: "subscription-client-" + suffix + "@example.com",
  });
  await TrainerSubscription.create({
    userId: trainer.user._id,
    planTitle: "Tiêu chuẩn",
    planCode: "standard",
    billingCycle: "month",
    source: "self_purchase",
    amount: 200000,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "active",
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
  await WeeklyCheckin.create({
    clientId: client.user._id,
    trainerIdAtCreation: trainer.user._id,
    weekStartDateKey: weekStart,
    status: "submitted",
    submittedAt: new Date(),
    revision: 1,
  });
  return { trainer, client, journal };
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use("/api/coaching-habits", coachingHabitRoutes);
  app.use("/api/progress", progressRoutes);
  app.use("/api/trainer-client-overview", trainerClientOverviewRoutes);
  app.use("/api/trainer-overview", trainerOverviewRoutes);
  app.use("/api/weekly-checkins", weeklyCheckinRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Today trainer access from TrainerSubscription", () => {
  it("grants every trainer read surface while preserving managed-client scope", async () => {
    const data = await seedSubscriptionTrainer("active");
    const token = data.trainer.accessToken;
    const clientId = data.client.user._id;
    const responses = await Promise.all([
      withAuth(
        request(app).get(
          "/api/trainer-client-overview/" +
            clientId +
            "?dateKey=" +
            today +
            "&days=7",
        ),
        token,
      ),
      withAuth(
        request(app).get(
          "/api/trainer-overview/clients/" +
            clientId +
            "?dateKey=" +
            today +
            "&days=7",
        ),
        token,
      ),
      withAuth(
        request(app).get(
          "/api/progress/trainer/clients/" + clientId + "?days=7",
        ),
        token,
      ),
      withAuth(
        request(app).get(
          "/api/coaching-habits/trainer/clients/" +
            clientId +
            "?dateKey=" +
            today,
        ),
        token,
      ),
      withAuth(
        request(app).get(
          "/api/weekly-checkins/trainer/clients/" +
            clientId +
            "/" +
            weekStart,
        ),
        token,
      ),
      withAuth(
        request(app).get(
          "/api/coaching-comments/daily_journal/" + data.journal._id,
        ),
        token,
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200,
      200,
      200,
      200,
      200,
      200,
    ]);
  });

  it("revokes subscription-trainer reads after the subscription expires", async () => {
    const data = await seedSubscriptionTrainer("expired");
    await TrainerSubscription.updateOne(
      { userId: data.trainer.user._id },
      { $set: { status: "expired", isActive: false } },
    );
    const overview = await withAuth(
      request(app).get(
        "/api/trainer-client-overview/" +
          data.client.user._id +
          "?dateKey=" +
          today +
          "&days=7",
      ),
      data.trainer.accessToken,
    );
    const comments = await withAuth(
      request(app).get(
        "/api/coaching-comments/daily_journal/" + data.journal._id,
      ),
      data.trainer.accessToken,
    );

    expect(overview.status).toBe(403);
    expect(comments.status).toBe(403);
  });

  it("keeps the client scope when a subscription trainer comments on their own journal", async () => {
    const data = await seedSubscriptionTrainer("dual-scope");
    const coach = await createTestUser({
      email: "dual-scope-coach@example.com",
      role: "trainer",
    });
    await Order.create({
      userId: data.trainer.user._id,
      trainerId: coach.user._id,
      name: data.trainer.user.name,
      email: data.trainer.user.email,
      package: "PT",
      sessions: 2,
      totalSessions: 2,
      status: "approved",
    });
    const ownJournal = await DailyJournal.create({
      clientId: data.trainer.user._id,
      trainerIdAtCreation: coach.user._id,
      dateKey: addDaysToDateKey(today, -1),
      revision: 1,
    });
    process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
    try {
      const response = await withAuth(
        request(app).post("/api/coaching-comments").send({
          targetType: "daily_journal",
          targetId: ownJournal._id,
          requestId: "a5555555-5555-4555-8555-555555555555",
          body: "Bình luận trong vai trò khách hàng",
        }),
        data.trainer.accessToken,
      );

      expect(response.status).toBe(201);
      expect((await CoachingComment.findOne()).actorRole).toBe("user");
    } finally {
      delete process.env.TODAY_COMMENT_WRITES_ENABLED;
    }
  });
});
