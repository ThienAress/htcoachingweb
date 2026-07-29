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
import CoachingDay from "../../models/CoachingDay.js";
import CoachingHabit from "../../models/CoachingHabit.js";
import DailyJournal from "../../models/DailyJournal.js";
import Order from "../../models/Order.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import todayDashboardRoutes from "../../routes/todayDashboard.routes.js";
import trainerOverviewRoutes from "../../routes/trainerOverview.routes.js";
import coachingRoutes from "../../routes/coaching.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const currentWeek = addDaysToDateKey(today, -getAppDayOfWeek(today));
const range = getVietnamDayRangeUtc(today);

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: "overview-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "overview-client-" + suffix + "@example.com",
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

const habit = (data, lineageKey, visibility) =>
  CoachingHabit.create({
    clientId: data.client.user._id,
    trainerIdAtCreation: data.trainer.user._id,
    createdById: data.client.user._id,
    createdByRole: "user",
    lineageKey,
    version: 1,
    status: "active",
    title: visibility + " habit",
    category: "recovery",
    schedule: { daysOfWeek: [getAppDayOfWeek(today)], startDateKey: today },
    visibility,
    commandActorId: data.client.user._id,
    commandType: "create",
    commandRequestId:
      visibility === "shared"
        ? "a1111111-1111-4111-8111-111111111111"
        : "a2222222-2222-4222-8222-222222222222",
    payloadFingerprint: "b".repeat(64),
  });

const seed = async (data) => {
  const privateHabit = await habit(
    data,
    "a3333333-3333-4333-8333-333333333333",
    "private",
  );
  const sharedHabit = await habit(
    data,
    "a4444444-4444-4444-8444-444444444444",
    "shared",
  );
  await Promise.all([
    DailyJournal.create({
      clientId: data.client.user._id,
      trainerIdAtCreation: data.trainer.user._id,
      dateKey: today,
      wellness: { pain: 4, energy: 7 },
      notes: { private: "Không được lộ", shared: "Có thể chia sẻ" },
      habitCompletions: [privateHabit, sharedHabit].map((item) => ({
        habitId: item._id,
        lineageKey: item.lineageKey,
        version: 1,
        titleSnapshot: item.title,
        status: "completed",
        recordedAt: new Date(),
      })),
      revision: 1,
    }),
    TrainingSchedule.create({
      trainerId: data.trainer.user._id,
      clientId: data.client.user._id,
      clientName: data.client.user.name,
      occurrenceDateKey: today,
      startAt: new Date(range.start.getTime() + 8 * 60 * 60 * 1000),
      endAt: new Date(range.start.getTime() + 9 * 60 * 60 * 1000),
      dayOfWeek: getAppDayOfWeek(today),
      startTime: "08:00",
      endTime: "09:00",
      exerciseType: "Strength",
      status: "completed",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    }),
    CoachingDay.create({
      userId: data.client.user._id,
      trainerId: data.trainer.user._id,
      dateString: today,
      date: range.start,
      title: "Pending coaching",
      clientStatus: "pending",
    }),
    WeeklyCheckin.create({
      clientId: data.client.user._id,
      trainerIdAtCreation: data.trainer.user._id,
      weekStartDateKey: currentWeek,
      body: { energy: 7 },
      status: "submitted",
      submittedAt: new Date(),
      revision: 1,
    }),
  ]);
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/today-dashboard", todayDashboardRoutes);
  app.use("/api/trainer-overview", trainerOverviewRoutes);
  app.use("/api/coaching", coachingRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Trainer client overview", () => {
  it("reuses Today/Progress formulas while removing private journal habit data", async () => {
    const data = await createAssigned("shared");
    await seed(data);
    const ownToday = await withAuth(
      request(app).get("/api/today-dashboard/day/" + today),
      data.client.accessToken,
    );
    const overview = await withAuth(
      request(app).get(
        "/api/trainer-overview/clients/" +
          data.client.user._id +
          "?dateKey=" +
          today +
          "&days=7",
      ),
      data.trainer.accessToken,
    );

    expect(overview.status).toBe(200);
    expect(overview.headers["cache-control"]).toBe("private, no-store");
    expect(overview.body.data.today.summary).toEqual(
      ownToday.body.data.summary,
    );
    expect(JSON.stringify(overview.body.data.today)).not.toContain(
      "Không được lộ",
    );
    expect(
      overview.body.data.today.sections.journal.day.habitCompletions,
    ).toHaveLength(1);
    expect(overview.body.data.weeklyCheckin.status).toBe("submitted");
    expect(overview.body.data.attention.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "weekly_checkin_missing",
        "pain_reported",
        "weekly_review_pending",
      ]),
    );
  });

  it("blocks other trainers and revokes current trainer immediately", async () => {
    const data = await createAssigned("idor");
    const outsider = await createAssigned("outsider");
    const path =
      "/api/trainer-overview/clients/" +
      data.client.user._id +
      "?dateKey=" +
      today +
      "&days=30";
    const denied = await withAuth(
      request(app).get(path),
      outsider.trainer.accessToken,
    );
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    const revoked = await withAuth(
      request(app).get(path),
      data.trainer.accessToken,
    );

    expect(denied.status).toBe(403);
    expect(revoked.status).toBe(403);
  });

  it("keeps the trainer client picker limited to approved orders with sessions", async () => {
    const data = await createAssigned("picker");
    const inactiveClient = await createTestUser({
      email: "overview-inactive-client@example.com",
    });
    await Order.create({
      userId: inactiveClient.user._id,
      trainerId: data.trainer.user._id,
      name: inactiveClient.user.name,
      email: inactiveClient.user.email,
      package: "Expired",
      sessions: 0,
      totalSessions: 5,
      status: "approved",
    });

    const response = await withAuth(
      request(app).get("/api/coaching/trainer/clients"),
      data.trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map((client) => String(client._id))).toEqual([
      String(data.client.user._id),
    ]);
  });
});
