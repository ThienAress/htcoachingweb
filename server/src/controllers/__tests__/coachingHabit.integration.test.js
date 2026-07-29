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
import CoachingHabit from "../../models/CoachingHabit.js";
import Order from "../../models/Order.js";
import coachingHabitRoutes from "../../routes/coachingHabit.routes.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const UUIDS = {
  create: "f1111111-1111-4111-8111-111111111111",
  second: "f2222222-2222-4222-8222-222222222222",
  trainer: "f3333333-3333-4333-8333-333333333333",
  status: "f4444444-4444-4444-8444-444444444444",
  completion: "f5555555-5555-4555-8555-555555555555",
  day2: "f6666666-6666-4666-8666-666666666666",
  day3: "f7777777-7777-4777-8777-777777777777",
};

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: `habit-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `habit-client-${suffix}@example.com`,
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

const habitPayload = (requestId, overrides = {}) => ({
  requestId,
  title: "Uống đủ nước",
  description: "Theo dõi hằng ngày",
  category: "nutrition",
  schedule: {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDateKey: addDaysToDateKey(today, -30),
    endDateKey: null,
  },
  ...overrides,
});

const createOwnHabit = (token, body) =>
  withAuth(request(app).post("/api/coaching-habits").send(body), token);

const saveCompletions = (
  token,
  dateKey,
  requestId,
  habitId,
  status = "completed",
  expectedRevision = 0,
) =>
  withAuth(
    request(app).put(`/api/daily-journals/${dateKey}`).send({
      expectedRevision,
      requestId,
      patch: { habitCompletions: [{ habitId, status }] },
    }),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-habits", coachingHabitRoutes);
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_HABIT_WRITES_ENABLED = "true";
  process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_HABIT_WRITES_ENABLED;
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Coaching Habit contract", () => {
  it("creates a private client habit idempotently and rejects request reuse", async () => {
    const { client } = await createAssigned("idempotent");
    const payload = habitPayload(UUIDS.create);
    const created = await createOwnHabit(client.accessToken, payload);
    const replay = await createOwnHabit(client.accessToken, payload);
    const reused = await createOwnHabit(client.accessToken, {
      ...payload,
      title: "Payload khác",
    });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      version: 1,
      isLatest: true,
      visibility: "private",
      createdByRole: "user",
    });
    expect(replay.body.idempotentReplay).toBe(true);
    expect(reused.status).toBe(409);
    expect(await CoachingHabit.countDocuments()).toBe(1);
  });

  it("shows trainers only their managed, trainer-created or explicitly shared habits", async () => {
    const assigned = await createAssigned("scope");
    const outsider = await createAssigned("outsider");
    await createOwnHabit(
      assigned.client.accessToken,
      habitPayload(UUIDS.create),
    );
    await createOwnHabit(
      assigned.client.accessToken,
      habitPayload(UUIDS.second, {
        title: "Shared by client",
        visibility: "shared",
      }),
    );
    const trainerCreated = await withAuth(
      request(app)
        .post(
          `/api/coaching-habits/trainer/clients/${assigned.client.user._id}`,
        )
        .send(habitPayload(UUIDS.trainer, { title: "Coach habit" })),
      assigned.trainer.accessToken,
    );
    const visible = await withAuth(
      request(app).get(
        `/api/coaching-habits/trainer/clients/${assigned.client.user._id}?dateKey=${today}`,
      ),
      assigned.trainer.accessToken,
    );
    const denied = await withAuth(
      request(app).get(
        `/api/coaching-habits/trainer/clients/${assigned.client.user._id}?dateKey=${today}`,
      ),
      outsider.trainer.accessToken,
    );

    expect(trainerCreated.status).toBe(201);
    expect(visible.body.data.items.map((item) => item.title).sort()).toEqual([
      "Coach habit",
      "Shared by client",
    ]);
    expect(denied.status).toBe(403);
  });

  it("creates an immutable lifecycle version and replays the status command", async () => {
    const { client } = await createAssigned("status");
    const created = await createOwnHabit(
      client.accessToken,
      habitPayload(UUIDS.create),
    );
    const command = {
      status: "paused",
      expectedVersion: 1,
      requestId: UUIDS.status,
    };
    const paused = await withAuth(
      request(app)
        .post(`/api/coaching-habits/${created.body.data._id}/status`)
        .send(command),
      client.accessToken,
    );
    const replay = await withAuth(
      request(app)
        .post(`/api/coaching-habits/${created.body.data._id}/status`)
        .send(command),
      client.accessToken,
    );
    const versions = await CoachingHabit.find({}).sort({ version: 1 }).lean();

    expect(paused.body.data).toMatchObject({ version: 2, status: "paused" });
    expect(replay.body.idempotentReplay).toBe(true);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ version: 1, status: "active", isLatest: false });
  });

  it("snapshots a scheduled completion and rejects a non-scheduled habit", async () => {
    const { client } = await createAssigned("completion");
    const created = await createOwnHabit(
      client.accessToken,
      habitPayload(UUIDS.create),
    );
    const saved = await saveCompletions(
      client.accessToken,
      today,
      UUIDS.completion,
      created.body.data._id,
    );
    const wrongDay = (getAppDayOfWeek(today) + 1) % 7;
    const unscheduled = await createOwnHabit(
      client.accessToken,
      habitPayload(UUIDS.second, {
        title: "Not today",
        schedule: {
          daysOfWeek: [wrongDay],
          startDateKey: addDaysToDateKey(today, -30),
          endDateKey: null,
        },
      }),
    );
    const rejected = await saveCompletions(
      client.accessToken,
      today,
      UUIDS.day2,
      unscheduled.body.data._id,
      "completed",
      1,
    );

    expect(saved.status).toBe(200);
    expect(saved.body.data.habitCompletions[0]).toMatchObject({
      habitId: created.body.data._id,
      version: 1,
      titleSnapshot: "Uống đủ nước",
      status: "completed",
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe("HABIT_NOT_SCHEDULED");
  });

  it("derives streak from scheduled Daily Journal completions", async () => {
    const { client } = await createAssigned("streak");
    const created = await createOwnHabit(
      client.accessToken,
      habitPayload(UUIDS.create),
    );
    const dates = [addDaysToDateKey(today, -2), addDaysToDateKey(today, -1), today];
    const requestIds = [UUIDS.day2, UUIDS.day3, UUIDS.completion];
    for (let index = 0; index < dates.length; index += 1) {
      const response = await saveCompletions(
        client.accessToken,
        dates[index],
        requestIds[index],
        created.body.data._id,
      );
      expect(response.status).toBe(200);
    }
    const listed = await withAuth(
      request(app).get(`/api/coaching-habits/my?dateKey=${today}`),
      client.accessToken,
    );

    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0]).toMatchObject({
      scheduledToday: true,
      currentStreak: 3,
      formulaVersion: "habit-streak-v1",
    });
  });
});
