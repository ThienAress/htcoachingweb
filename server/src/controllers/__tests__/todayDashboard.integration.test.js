import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
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
import todayDashboardRoutes from "../../routes/todayDashboard.routes.js";
import Checkin from "../../models/Checkin.js";
import CoachingDay from "../../models/CoachingDay.js";
import DailyJournal from "../../models/DailyJournal.js";
import SavedMealPlan from "../../models/SavedMealPlan.js";
import Order from "../../models/Order.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import {
  getAppDayOfWeek,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../../utils/dateKey.js";

let app;

const DATE_KEY = "2030-01-02";

const getDay = (token, dateKey = DATE_KEY) =>
  withAuth(
    request(app).get("/api/today-dashboard/day/" + dateKey),
    token,
  );

const createOrder = ({
  userId,
  trainerId,
  status = "approved",
  sessions = 5,
}) =>
  Order.create({
    userId,
    trainerId,
    name: "Today Client",
    email: "today-client@example.com",
    package: "PT 10",
    sessions,
    totalSessions: 10,
    status,
  });

const createSavedMealPlan = ({ ownerId, trainerId }) => {
  const meal = (key, name, type) => ({
    key,
    name,
    type,
    foods: [
      {
        foodId: new SavedMealPlan()._id,
        label: name,
        amountGrams: 100,
        nutrition: { protein: 10, carb: 20, fat: 5, calories: 165 },
      },
    ],
    totals: { protein: 10, carb: 20, fat: 5, calories: 165 },
  });

  return SavedMealPlan.create({
    ownerId,
    trainerIdAtCreation: trainerId,
    lineageKey: "10000000-0000-4000-8000-000000000001",
    version: 1,
    isLatest: true,
    status: "active",
    title: "Today meal plan",
    meals: [
      meal("breakfast", "Breakfast", "breakfast"),
      meal("lunch", "Lunch", "lunch"),
    ],
    totals: { protein: 20, carb: 40, fat: 10, calories: 330 },
    commandType: "create",
    createdByRequestId: "today-module-progress-plan",
    payloadFingerprint: "a".repeat(64),
  });
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/today-dashboard", todayDashboardRoutes);
  await Promise.all([
    Checkin.init(),
    CoachingDay.init(),
    DailyJournal.init(),
    SavedMealPlan.init(),
    Order.init(),
    TrainingSchedule.init(),
    WorkoutPlan.init(),
  ]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearCollections();
  delete process.env.DEFAULT_ADMIN_TRAINER_ID;
  delete process.env.TODAY_DASHBOARD_ENABLED;
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Today Dashboard read-only aggregation", () => {
  it("requires authentication before querying private sources", async () => {
    const response = await request(app).get(
      "/api/today-dashboard/day/" + DATE_KEY,
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid calendar dates", async () => {
    const client = await createTestUser({
      email: "today-invalid-date@example.com",
    });

    expect((await getDay(client.accessToken, "2030-02-29")).status).toBe(400);
    expect((await getDay(client.accessToken, "2028-02-29")).status).toBe(200);
  });

  it("returns onboarding contract for a user who never had coaching", async () => {
    const client = await createTestUser({
      email: "today-never-coached@example.com",
    });
    const response = await getDay(client.accessToken);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("private");
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data).toMatchObject({
      contractVersion: 2,
      dateKey: DATE_KEY,
      timeZone: "Asia/Ho_Chi_Minh",
      eligibility: { status: "never_coached" },
      capabilities: { canViewSources: false },
    });
    expect(response.body.data.sections.coaching.status).toBe("empty");
  });

  it("distinguishes pending and assignment-required states", async () => {
    const pendingClient = await createTestUser({
      email: "today-pending@example.com",
    });
    await createOrder({
      userId: pendingClient.user._id,
      status: "pending",
      sessions: 10,
    });

    const pending = await getDay(pendingClient.accessToken);
    expect(pending.body.data.eligibility.status).toBe("pending");

    const unassignedClient = await createTestUser({
      email: "today-unassigned@example.com",
    });
    await createOrder({
      userId: unassignedClient.user._id,
      trainerId: null,
    });
    await CoachingDay.create({
      userId: unassignedClient.user._id,
      trainerId: unassignedClient.user._id,
      dateString: DATE_KEY,
      date: getVietnamDayRangeUtc(DATE_KEY).start,
      title: "Legacy coaching day",
      exercises: [],
    });

    const unassigned = await getDay(unassignedClient.accessToken);
    expect(unassigned.body.data.eligibility.status).toBe(
      "assignment_required",
    );
    expect(unassigned.body.data.capabilities).toMatchObject({
      canViewSources: true,
      canEditJournal: false,
      canSubmitDay: false,
      canComment: false,
    });
    expect(unassigned.body.data.sections.coaching).toMatchObject({
      status: "ready",
      day: { title: "Legacy coaching day" },
    });
  });

  it("aggregates only owned, customer-visible source summaries", async () => {
    const trainer = await createTestUser({
      email: "today-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "today-client@example.com",
    });
    const order = await createOrder({
      userId: client.user._id,
      trainerId: trainer.user._id,
    });
    const range = getVietnamDayRangeUtc(DATE_KEY);

    await Promise.all([
      TrainingSchedule.create({
        trainerId: trainer.user._id,
        clientId: client.user._id,
        clientName: client.user.name,
        occurrenceDateKey: DATE_KEY,
        startAt: new Date(range.start.getTime() + 2 * 60 * 60 * 1000),
        endAt: new Date(range.start.getTime() + 3 * 60 * 60 * 1000),
        dayOfWeek: getAppDayOfWeek(DATE_KEY),
        startTime: "09:00",
        endTime: "10:00",
        exerciseType: "Gym",
        notes: "Leg day",
        status: "scheduled",
        expiresAt: range.end,
      }),
      TrainingSchedule.create({
        trainerId: trainer.user._id,
        clientId: client.user._id,
        clientName: client.user.name,
        occurrenceDateKey: DATE_KEY,
        dayOfWeek: getAppDayOfWeek(DATE_KEY),
        startTime: "11:00",
        endTime: "12:00",
        exerciseType: "Boxing",
        status: "cancelled",
        expiresAt: range.end,
      }),
      CoachingDay.create({
        userId: client.user._id,
        trainerId: trainer.user._id,
        dateString: DATE_KEY,
        date: range.start,
        title: "Strength",
        videoUrl: "https://private.example/day.mp4",
        exercises: [
          {
            name: "Squat",
            sets: 4,
            reps: "8",
            completed: true,
            videoUrl: "https://private.example/squat.mp4",
          },
        ],
      }),
      WorkoutPlan.create({
        trainerId: trainer.user._id,
        clientId: client.user._id,
        clientName: client.user.name,
        clientEmail: client.user.email,
        title: "Published plan",
        planDate: new Date(range.start.getTime() + 4 * 60 * 60 * 1000),
        status: "published",
        sections: [{ name: "Strength", exercises: [{ name: "Squat" }] }],
      }),
      WorkoutPlan.create({
        trainerId: trainer.user._id,
        clientId: client.user._id,
        clientName: client.user.name,
        clientEmail: client.user.email,
        title: "Draft plan",
        planDate: new Date(range.start.getTime() + 4 * 60 * 60 * 1000),
        status: "draft",
      }),
      Checkin.create({
        orderId: order._id,
        clientRequestId: "today-checkin-inside",
        name: client.user.name,
        package: "PT 10",
        time: new Date(range.start.getTime() + 60 * 1000),
        muscle: "Legs",
        remainingSessions: 4,
      }),
      Checkin.create({
        orderId: order._id,
        clientRequestId: "today-checkin-outside",
        name: client.user.name,
        package: "PT 10",
        time: range.end,
        muscle: "Outside",
        remainingSessions: 3,
      }),
    ]);

    const response = await getDay(client.accessToken);
    const data = response.body.data;

    expect(response.status).toBe(200);
    expect(data.eligibility.status).toBe("active");
    expect(data.sections.schedule.items).toHaveLength(1);
    expect(data.sections.coaching.day.exercises).toHaveLength(1);
    expect(data.sections.workout.items).toHaveLength(1);
    expect(data.sections.workout.items[0].title).toBe("Published plan");
    expect(data.sections.attendance.items).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("private.example");
    expect(data.summary).toMatchObject({
      dayStatus: "in_progress",
      completionPercent: 17,
      formulaVersion: "today-v2",
      moduleProgress: {
        training: { completed: 1, total: 3, percent: 33 },
        nutrition: { completed: 0, total: 0, percent: null },
        journal: { completed: 0, total: 10, percent: 0 },
      },
    });
  });

  it("calculates nutrition completion from the exact assigned meal plan", async () => {
    const trainer = await createTestUser({
      email: "today-nutrition-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "today-nutrition-client@example.com",
    });
    await createOrder({
      userId: client.user._id,
      trainerId: trainer.user._id,
    });
    const plan = await createSavedMealPlan({
      ownerId: client.user._id,
      trainerId: trainer.user._id,
    });
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: DATE_KEY,
      nutrition: {
        assignment: {
          savedMealPlanId: plan._id,
          lineageKey: plan.lineageKey,
          version: plan.version,
          titleSnapshot: plan.title,
          assignedAt: new Date(),
        },
        entries: [
          {
            entryId: "20000000-0000-4000-8000-000000000001",
            mode: "follow_plan",
            status: "eaten",
            plannedMealKey: "breakfast",
            savedMealPlanId: plan._id,
            version: plan.version,
            labelSnapshot: "Breakfast",
            recordedAt: new Date(),
          },
        ],
      },
      revision: 1,
    });

    const partial = await getDay(client.accessToken);
    expect(partial.body.data.summary.moduleProgress.nutrition).toMatchObject({
      completed: 1,
      total: 2,
      percent: 50,
    });
    expect(
      partial.body.data.sections.journal.day.nutrition.plannedMealKeys,
    ).toEqual(["breakfast", "lunch"]);

    await DailyJournal.updateOne(
      { clientId: client.user._id, dateKey: DATE_KEY },
      {
        $push: {
          "nutrition.entries": {
            entryId: "20000000-0000-4000-8000-000000000002",
            mode: "follow_plan",
            status: "skipped",
            plannedMealKey: "lunch",
            savedMealPlanId: plan._id,
            version: plan.version,
            labelSnapshot: "Lunch",
            recordedAt: new Date(),
          },
        },
      },
    );

    const complete = await getDay(client.accessToken);
    expect(complete.body.data.summary.moduleProgress.nutrition.percent).toBe(
      100,
    );
  });

  it("allows an inactive client to read their own history", async () => {
    const trainer = await createTestUser({
      email: "today-history-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "today-history-client@example.com",
    });
    await createOrder({
      userId: client.user._id,
      trainerId: trainer.user._id,
      sessions: 0,
    });
    await CoachingDay.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      dateString: DATE_KEY,
      date: getVietnamDayRangeUtc(DATE_KEY).start,
      title: "Historical coaching",
    });

    const response = await getDay(client.accessToken);

    expect(response.body.data.eligibility.status).toBe("inactive");
    expect(response.body.data.capabilities.canViewSources).toBe(true);
    expect(response.body.data.sections.coaching.status).toBe("ready");
  });

  it("keeps healthy sections usable when one source fails", async () => {
    const trainer = await createTestUser({
      email: "today-partial-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "today-partial-client@example.com",
    });
    await createOrder({
      userId: client.user._id,
      trainerId: trainer.user._id,
    });
    vi.spyOn(WorkoutPlan, "find").mockImplementationOnce(() => {
      throw new Error("database unavailable");
    });

    const response = await getDay(client.accessToken);

    expect(response.status).toBe(200);
    expect(response.body.data.sections.workout).toMatchObject({
      status: "error",
      error: { code: "WORKOUT_SOURCE_UNAVAILABLE" },
    });
    expect(response.body.data.sections.schedule.status).toBe("empty");
    expect(response.body.data.partialErrors).toEqual([
      expect.objectContaining({
        section: "workout",
        code: "WORKOUT_SOURCE_UNAVAILABLE",
      }),
    ]);
  });

  it("supports an environment rollback without data cleanup", async () => {
    const client = await createTestUser({
      email: "today-disabled@example.com",
    });
    process.env.TODAY_DASHBOARD_ENABLED = "false";

    const response = await getDay(client.accessToken);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("TODAY_DASHBOARD_DISABLED");
  });

  it("adds an optional journal section and write capabilities for an active editable day", async () => {
    const trainer = await createTestUser({
      email: "today-journal-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "today-journal-client@example.com",
    });
    await createOrder({
      userId: client.user._id,
      trainerId: trainer.user._id,
    });
    const dateKey = getVietnamDateKey();
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey,
      wellness: { energy: 8, stress: 3 },
      revision: 1,
    });
    process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";

    const response = await getDay(client.accessToken, dateKey);

    expect(response.status).toBe(200);
    expect(response.body.data.sections.journal).toMatchObject({
      status: "ready",
      day: { revision: 1, wellness: { energy: 8, stress: 3 } },
    });
    expect(response.body.data.capabilities).toMatchObject({
      canEditJournal: true,
      canSubmitDay: true,
    });
  });
});
