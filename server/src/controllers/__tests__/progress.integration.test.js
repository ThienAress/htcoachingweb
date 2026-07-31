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
import Order from "../../models/Order.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import progressRoutes from "../../routes/progress.routes.js";
import {
  getAppDayOfWeek,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const range = getVietnamDayRangeUtc(today);

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: "progress-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "progress-client-" + suffix + "@example.com",
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
  app.use("/api/progress", progressRoutes);
  app.use(errorHandler);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Progress Hub API", () => {
  it("excludes draft journals until the client submits them", async () => {
    const assigned = await createAssigned("submitted-journal");
    const journal = await DailyJournal.create({
      clientId: assigned.client.user._id,
      trainerIdAtCreation: assigned.trainer.user._id,
      dateKey: today,
      status: "draft",
      wellness: { energy: 8 },
      revision: 1,
    });

    const readEnergyAverage = async () => {
      const response = await withAuth(
        request(app).get("/api/progress?days=7"),
        assigned.client.accessToken,
      );
      return response.body.data.wellness.energy.average;
    };

    const draftAverage = await readEnergyAverage();
    await DailyJournal.updateOne(
      { _id: journal._id },
      { $set: { status: "submitted", submittedAt: new Date() } },
    );
    const submittedAverage = await readEnergyAverage();

    expect([draftAverage, submittedAverage]).toEqual([null, 8]);
  });

  it("shares canonical metrics while excluding client-private habits from trainer input", async () => {
    const assigned = await createAssigned("shared");
    const lineageKey = "71111111-1111-4111-8111-111111111111";
    const habit = await CoachingHabit.create({
      clientId: assigned.client.user._id,
      trainerIdAtCreation: assigned.trainer.user._id,
      createdById: assigned.client.user._id,
      createdByRole: "user",
      lineageKey,
      version: 1,
      status: "active",
      title: "Private habit",
      category: "recovery",
      schedule: {
        daysOfWeek: [getAppDayOfWeek(today)],
        startDateKey: today,
      },
      visibility: "private",
      commandActorId: assigned.client.user._id,
      commandType: "create",
      commandRequestId: "72222222-2222-4222-8222-222222222222",
      payloadFingerprint: "a".repeat(64),
    });
    await DailyJournal.create({
      clientId: assigned.client.user._id,
      trainerIdAtCreation: assigned.trainer.user._id,
      dateKey: today,
      status: "submitted",
      submittedAt: new Date(),
      wellness: { sleepHours: 8, energy: 7 },
      habitCompletions: [
        {
          habitId: habit._id,
          lineageKey,
          version: 1,
          titleSnapshot: habit.title,
          status: "completed",
          recordedAt: new Date(),
        },
      ],
      revision: 1,
    });
    await TrainingSchedule.create({
      trainerId: assigned.trainer.user._id,
      clientId: assigned.client.user._id,
      clientName: assigned.client.user.name,
      occurrenceDateKey: today,
      startAt: new Date(range.start.getTime() + 8 * 60 * 60 * 1000),
      endAt: new Date(range.start.getTime() + 9 * 60 * 60 * 1000),
      dayOfWeek: getAppDayOfWeek(today),
      startTime: "08:00",
      endTime: "09:00",
      exerciseType: "Strength",
      status: "completed",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    const own = await withAuth(
      request(app).get("/api/progress?days=7"),
      assigned.client.accessToken,
    );
    const trainer = await withAuth(
      request(app).get(
        "/api/progress/trainer/clients/" +
          assigned.client.user._id +
          "?days=7",
      ),
      assigned.trainer.accessToken,
    );

    expect(own.status).toBe(200);
    expect(own.headers["cache-control"]).toContain("private");
    expect(own.body.data).toMatchObject({
      formulaVersion: "progress-v2",
      range: { days: 7 },
      compliance: {
        scheduleAttendance: { percent: 100 },
        habitCompliance: { numerator: 1, denominator: 1, percent: 100 },
      },
      wellness: { sleepHours: { average: 8, count: 1 } },
    });
    expect(trainer.status).toBe(200);
    expect(trainer.body.data.compliance.scheduleAttendance).toEqual(
      own.body.data.compliance.scheduleAttendance,
    );
    expect(trainer.body.data.compliance.habitCompliance).toEqual({
      numerator: 0,
      denominator: 0,
      percent: null,
    });
  });

  it("recomputes current metrics after a trainer edits and deletes source data", async () => {
    const assigned = await createAssigned("source-refresh");
    const schedule = await TrainingSchedule.create({
      trainerId: assigned.trainer.user._id,
      clientId: assigned.client.user._id,
      clientName: assigned.client.user.name,
      occurrenceDateKey: today,
      startAt: new Date(range.start.getTime() + 8 * 60 * 60 * 1000),
      endAt: new Date(range.start.getTime() + 9 * 60 * 60 * 1000),
      dayOfWeek: getAppDayOfWeek(today),
      startTime: "08:00",
      endTime: "09:00",
      exerciseType: "Strength",
      status: "scheduled",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    const readPercent = async () => {
      const response = await withAuth(
        request(app).get("/api/progress?days=7"),
        assigned.client.accessToken,
      );
      return response.body.data.compliance.scheduleAttendance.percent;
    };

    const beforeEdit = await readPercent();
    await TrainingSchedule.updateOne(
      { _id: schedule._id },
      { $set: { status: "completed" } },
    );
    const afterEdit = await readPercent();
    await TrainingSchedule.deleteOne({ _id: schedule._id });
    const afterDelete = await readPercent();

    expect([beforeEdit, afterEdit, afterDelete]).toEqual([null, 100, null]);
  });
  it("rejects invalid ranges and trainer IDOR, then revokes access immediately", async () => {
    const assigned = await createAssigned("idor");
    const outsider = await createAssigned("outsider");
    const invalid = await withAuth(
      request(app).get("/api/progress?days=365"),
      assigned.client.accessToken,
    );
    const denied = await withAuth(
      request(app).get(
        "/api/progress/trainer/clients/" +
          assigned.client.user._id +
          "?days=7",
      ),
      outsider.trainer.accessToken,
    );
    await Order.updateMany(
      { userId: assigned.client.user._id },
      { $set: { sessions: 0 } },
    );
    const ownHistory = await withAuth(
      request(app).get("/api/progress?days=30"),
      assigned.client.accessToken,
    );
    const revoked = await withAuth(
      request(app).get(
        "/api/progress/trainer/clients/" +
          assigned.client.user._id +
          "?days=30",
      ),
      assigned.trainer.accessToken,
    );

    expect(invalid.status).toBe(400);
    expect(denied.status).toBe(403);
    expect(ownHistory.status).toBe(200);
    expect(revoked.status).toBe(403);
  });
});
