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
  runReleaseECoachingHabitMigration,
  verifyReleaseECoachingHabitMigration,
} from "../../migrations/20260729-today-dashboard-release-e.js";
import CoachingHabit from "../../models/CoachingHabit.js";
import Order from "../../models/Order.js";
import coachingHabitRoutes from "../../routes/coachingHabit.routes.js";
import opsRoutes from "../../routes/ops.routes.js";
import userRoutes from "../../routes/user.routes.js";
import {
  runCoachingHabitRetentionSweep,
} from "../../services/coachingHabitPrivacy.service.js";
import {
  syncDailyJournalRetentionForClient,
} from "../../services/dailyJournalRetentionPolicy.service.js";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const REQUEST_ID = "e8888888-8888-4888-8888-888888888888";

const createActive = async (suffix) => {
  const trainer = await createTestUser({
    email: `habit-privacy-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `habit-privacy-client-${suffix}@example.com`,
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

const createHabit = (client, requestId = REQUEST_ID) =>
  withAuth(
    request(app).post("/api/coaching-habits").send({
      requestId,
      title: "Privacy habit",
      category: "recovery",
      schedule: {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDateKey: addDaysToDateKey(today, -30),
        endDateKey: null,
      },
    }),
    client.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-habits", coachingHabitRoutes);
  app.use("/api/ops", opsRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_HABIT_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_HABIT_WRITES_ENABLED;
  delete process.env.TODAY_HABIT_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Coaching Habit privacy lifecycle", () => {
  it("exports own definitions and deletes every immutable version", async () => {
    const { client } = await createActive("delete");
    await createHabit(client);
    const exported = await withAuth(
      request(app).get("/api/coaching-habits/privacy/export"),
      client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/coaching-habits/privacy")
        .send({ confirmation: "DELETE_MY_COACHING_HABITS" }),
      client.accessToken,
    );

    expect(exported.status).toBe(200);
    expect(exported.body.data.items).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain("payloadFingerprint");
    expect(deleted.body.data).toEqual({ habits: 1 });
    expect(await CoachingHabit.countDocuments()).toBe(0);
  });

  it("schedules retention on coaching end and clears it on renewal", async () => {
    const data = await createActive("policy");
    const created = await createHabit(data.client);
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
      coachingEndedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    const retained = await CoachingHabit.findById(created.body.data._id);
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
      (await CoachingHabit.findById(created.body.data._id)).retentionExpiresAt,
    ).toBeNull();
  });

  it("protects active clients and gates retention enforcement", async () => {
    const data = await createActive("retention");
    const admin = await createTestUser({
      email: "habit-privacy-admin@example.com",
      role: "admin",
    });
    const created = await createHabit(data.client);
    await CoachingHabit.updateOne(
      { _id: created.body.data._id },
      { $set: { retentionExpiresAt: new Date(Date.now() - 60_000) } },
    );
    process.env.TODAY_HABIT_RETENTION_ENFORCE = "true";
    const protectedResult = await runCoachingHabitRetentionSweep({
      enforce: true,
      actorId: admin.user._id,
    });
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    delete process.env.TODAY_HABIT_RETENTION_ENFORCE;
    const disabled = await withAuth(
      request(app)
        .post("/api/ops/privacy/coaching-habits/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );
    process.env.TODAY_HABIT_RETENTION_ENFORCE = "true";
    const enforced = await withAuth(
      request(app)
        .post("/api/ops/privacy/coaching-habits/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(protectedResult).toMatchObject({ candidates: 0, deleted: 0 });
    expect(disabled.status).toBe(503);
    expect(enforced.body.data.deleted).toBe(1);
  });

  it("creates indexes without backfill and joins admin user deletion inventory", async () => {
    const result = await runReleaseECoachingHabitMigration();
    const data = await createActive("admin-delete");
    const admin = await createTestUser({
      email: "habit-delete-admin@example.com",
      role: "admin",
    });
    await createHabit(data.client);
    const deleted = await withAuth(
      request(app).delete(`/api/user/${data.client.user._id}`),
      admin.accessToken,
    );

    expect(result.documentsModified).toBe(0);
    expect(result.verification.totalIssues).toBe(0);
    expect((await verifyReleaseECoachingHabitMigration()).totalIssues).toBe(0);
    expect(deleted.status).toBe(200);
    expect(await CoachingHabit.countDocuments()).toBe(0);
  });
});
