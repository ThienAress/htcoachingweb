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
import CoachingHabit from "../../models/CoachingHabit.js";
import DailyJournal from "../../models/DailyJournal.js";
import AuditLog from "../../models/AuditLog.js";
import Order from "../../models/Order.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import trainerClientOverviewRoutes from "../../routes/trainerClientOverview.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getMonthWeekPeriod,
  getPreviousMonthWeekPeriod,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const currentWeek = getMonthWeekPeriod(today).startDateKey;
const previousWeek = getPreviousMonthWeekPeriod(today).startDateKey;
const dayRange = getVietnamDayRangeUtc(today);

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

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/trainer-client-overview", trainerClientOverviewRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Trainer client overview", () => {
  it("reuses canonical Today/Progress models, hides private notes and returns generic attention", async () => {
    const data = await createAssigned("canonical");
    const habits = await CoachingHabit.create([
      {
        clientId: data.client.user._id,
        trainerIdAtCreation: data.trainer.user._id,
        createdById: data.client.user._id,
        createdByRole: "user",
        lineageKey: "a3333333-3333-4333-8333-333333333333",
        version: 1,
        status: "active",
        title: "Habit riêng tư",
        category: "recovery",
        schedule: {
          daysOfWeek: [getAppDayOfWeek(today)],
          startDateKey: today,
        },
        visibility: "private",
        commandActorId: data.client.user._id,
        commandType: "create",
        commandRequestId: "a1111111-1111-4111-8111-111111111111",
        payloadFingerprint: "a".repeat(64),
      },
      {
        clientId: data.client.user._id,
        trainerIdAtCreation: data.trainer.user._id,
        createdById: data.client.user._id,
        createdByRole: "user",
        lineageKey: "a4444444-4444-4444-8444-444444444444",
        version: 1,
        status: "active",
        title: "Habit chia sẻ",
        category: "recovery",
        schedule: {
          daysOfWeek: [getAppDayOfWeek(today)],
          startDateKey: today,
        },
        visibility: "shared",
        commandActorId: data.client.user._id,
        commandType: "create",
        commandRequestId: "a2222222-2222-4222-8222-222222222222",
        payloadFingerprint: "b".repeat(64),
      },
    ]);
    await DailyJournal.create({
      clientId: data.client.user._id,
      trainerIdAtCreation: data.trainer.user._id,
      dateKey: today,
      wellness: { energy: 8, pain: 4, painArea: "Vai trái" },
      notes: { private: "Không chia sẻ", shared: "Có thể xem" },
      status: "submitted",
      submittedAt: new Date(),
      habitCompletions: habits.map((habit) => ({
        habitId: habit._id,
        lineageKey: habit.lineageKey,
        version: habit.version,
        titleSnapshot: habit.title,
        status: "completed",
        recordedAt: new Date(),
      })),
      revision: 1,
    });
    await TrainingSchedule.create({
      trainerId: data.trainer.user._id,
      clientId: data.client.user._id,
      clientName: data.client.user.name,
      occurrenceDateKey: today,
      startAt: new Date(dayRange.start.getTime() + 8 * 60 * 60 * 1000),
      endAt: new Date(dayRange.start.getTime() + 9 * 60 * 60 * 1000),
      dayOfWeek: getAppDayOfWeek(today),
      startTime: "08:00",
      endTime: "09:00",
      exerciseType: "Strength",
      status: "completed",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    const weekly = await WeeklyCheckin.create({
      clientId: data.client.user._id,
      trainerIdAtCreation: data.trainer.user._id,
      weekStartDateKey: currentWeek,
      body: { energy: 8 },
      status: "submitted",
      revision: 2,
    });
    const response = await withAuth(
      request(app).get(
        "/api/trainer-client-overview/" +
          data.client.user._id +
          "?dateKey=" +
          today +
          "&days=7",
      ),
      data.trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("private");
    expect(response.body.data.today.summary.formulaVersion).toBe("today-v2");
    expect(response.body.data.weeklyCheckin._id).toBe(String(weekly._id));
    expect(
      response.body.data.progress.compliance.scheduleAttendance.percent,
    ).toBe(100);
    expect(response.body.data.today.sections.journal.day.notes).toEqual({
      shared: "Có thể xem",
    });
    expect(
      response.body.data.today.sections.journal.day.habitCompletions,
    ).toEqual([
      expect.objectContaining({ titleSnapshot: "Habit chia sẻ" }),
    ]);
    expect(JSON.stringify(response.body.data)).not.toContain("Không chia sẻ");
    expect(JSON.stringify(response.body.data)).not.toContain("Habit riêng tư");
    expect(JSON.stringify(response.body.data.attention)).not.toContain(
      "Vai trái",
    );
    expect(response.body.data.attention.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "pain_reported" }),
        expect.objectContaining({
          code: "weekly_review_pending",
          targetId: String(weekly._id),
        }),
        expect.objectContaining({
          code: "weekly_checkin_missing",
          dateKey: previousWeek,
        }),
      ]),
    );
    expect(
      await AuditLog.countDocuments({
        actorId: data.trainer.user._id,
        action: "read_trainer_client_overview",
        targetId: data.client.user._id,
      }),
    ).toBe(1);
  });

  it("does not return draft wellness or draft pain attention to a trainer", async () => {
    const data = await createAssigned("draft-private");
    await DailyJournal.create({
      clientId: data.client.user._id,
      trainerIdAtCreation: data.trainer.user._id,
      dateKey: today,
      wellness: { energy: 9, pain: 8 },
      notes: { private: "Bản nháp riêng", shared: "Chưa gửi cho HLV" },
      status: "draft",
      revision: 1,
    });

    const response = await withAuth(
      request(app).get(
        "/api/trainer-client-overview/" +
          data.client.user._id +
          "?dateKey=" +
          today +
          "&days=7",
      ),
      data.trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.today.sections.journal.day).toBeNull();
    expect(response.body.data.attention.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "pain_reported" })]),
    );
    expect(JSON.stringify(response.body.data)).not.toContain("Chưa gửi cho HLV");
    expect(JSON.stringify(response.body.data)).not.toContain("Bản nháp riêng");
  });

  it("lets an admin read the overview for any active client", async () => {
    const data = await createAssigned("admin");
    const admin = await createTestUser({
      email: "overview-admin@example.com",
      role: "admin",
    });
    const response = await withAuth(
      request(app).get(
        "/api/trainer-client-overview/" +
          data.client.user._id +
          "?dateKey=" +
          today +
          "&days=180",
      ),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.clientId).toBe(String(data.client.user._id));
    expect(response.body.data.progress.range.days).toBe(180);
  });

  it("blocks other trainers and revokes current trainer immediately", async () => {
    const data = await createAssigned("idor");
    const outsider = await createAssigned("outsider");
    const path =
      "/api/trainer-client-overview/" +
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
});
