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
const trainerInputStart = addDaysToDateKey(today, -30);
const trainerWeekStart = addDaysToDateKey(
  trainerInputStart,
  -getAppDayOfWeek(trainerInputStart),
);
const trainerWeekEnd = addDaysToDateKey(trainerWeekStart, 6);
const UUIDS = {
  create: "f1111111-1111-4111-8111-111111111111",
  second: "f2222222-2222-4222-8222-222222222222",
  trainer: "f3333333-3333-4333-8333-333333333333",
  status: "f4444444-4444-4444-8444-444444444444",
  completion: "f5555555-5555-4555-8555-555555555555",
  day2: "f6666666-6666-4666-8666-666666666666",
  day3: "f7777777-7777-4777-8777-777777777777",
  adminCreate: "f8888888-8888-4888-8888-888888888888",
  update: "fa111111-1111-4111-8111-111111111111",
  updateStale: "fa222222-2222-4222-8222-222222222222",
  adminUpdate: "fa333333-3333-4333-8333-333333333333",
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

const updateHabit = (token, habitId, body) =>
  withAuth(
    request(app).put(`/api/coaching-habits/${habitId}`).send(body),
    token,
  );

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
        .send(
          habitPayload(UUIDS.trainer, {
            title: "Coach habit",
            schedule: {
              daysOfWeek: [2],
              startDateKey: addDaysToDateKey(today, -30),
              endDateKey: addDaysToDateKey(today, 30),
            },
          }),
        ),
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
    expect(trainerCreated.body.data.schedule).toEqual({
      daysOfWeek: [2],
      startDateKey: trainerWeekStart,
      endDateKey: trainerWeekEnd,
    });
    expect(visible.body.data.items.map((item) => item.title).sort()).toEqual([
      "Coach habit",
      "Shared by client",
    ]);
    expect(denied.status).toBe(403);
  });

  it("lets admin manage trainer habits for any active client", async () => {
    const assigned = await createAssigned("admin-scope");
    const admin = await createTestUser({
      email: "habit-admin@example.com",
      role: "admin",
    });
    const trainerCreated = await withAuth(
      request(app)
        .post(
          "/api/coaching-habits/trainer/clients/" + assigned.client.user._id,
        )
        .send(habitPayload(UUIDS.trainer, { title: "Trainer habit" })),
      assigned.trainer.accessToken,
    );

    const visible = await withAuth(
      request(app).get(
        "/api/coaching-habits/trainer/clients/" +
          assigned.client.user._id +
          "?dateKey=" +
          today,
      ),
      admin.accessToken,
    );
    const adminCreated = await withAuth(
      request(app)
        .post(
          "/api/coaching-habits/trainer/clients/" + assigned.client.user._id,
        )
        .send(habitPayload(UUIDS.adminCreate, { title: "Admin habit" })),
      admin.accessToken,
    );
    const adminUpdated = await updateHabit(
      admin.accessToken,
      trainerCreated.body.data._id,
      {
        ...habitPayload(UUIDS.adminUpdate, { title: "Admin updated habit" }),
        expectedVersion: 1,
      },
    );

    expect(visible.status).toBe(200);
    expect(visible.body.data.items[0].title).toBe("Trainer habit");
    expect(adminCreated.status).toBe(201);
    expect(adminCreated.body.data.createdByRole).toBe("trainer");
    expect(adminUpdated.body.data).toMatchObject({
      title: "Admin updated habit",
      status: "active",
      version: 2,
    });
  });

  it("ẩn habit HLV khi gói hết buổi nhưng giữ habit cá nhân", async () => {
    const assigned = await createAssigned("expired-order");
    await createOwnHabit(
      assigned.client.accessToken,
      habitPayload(UUIDS.create, { title: "Habit cá nhân" }),
    );
    await withAuth(
      request(app)
        .post(
          `/api/coaching-habits/trainer/clients/${assigned.client.user._id}`,
        )
        .send(habitPayload(UUIDS.trainer, { title: "Habit HLV" })),
      assigned.trainer.accessToken,
    );
    await Order.updateMany(
      { userId: assigned.client.user._id },
      { $set: { sessions: 0 } },
    );

    const listed = await withAuth(
      request(app).get(`/api/coaching-habits/my?dateKey=${today}`),
      assigned.client.accessToken,
    );

    expect(listed.status).toBe(200);
    expect(listed.body.data.items.map((item) => item.title)).toEqual([
      "Habit cá nhân",
    ]);
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

  it("updates a paused trainer habit and publishes the latest version immediately", async () => {
    const assigned = await createAssigned("update");
    const created = await withAuth(
      request(app)
        .post(
          `/api/coaching-habits/trainer/clients/${assigned.client.user._id}`,
        )
        .send(habitPayload(UUIDS.trainer, { title: "Đi bộ" })),
      assigned.trainer.accessToken,
    );
    const paused = await withAuth(
      request(app)
        .post(`/api/coaching-habits/${created.body.data._id}/status`)
        .send({
          status: "paused",
          expectedVersion: 1,
          requestId: UUIDS.status,
        }),
      assigned.trainer.accessToken,
    );

    const updateBody = {
      ...habitPayload(UUIDS.update, {
        title: "Đi bộ 30 phút",
        schedule: {
          daysOfWeek: [4],
          startDateKey: addDaysToDateKey(today, -60),
          endDateKey: addDaysToDateKey(today, 60),
        },
      }),
      expectedVersion: 2,
    };
    const updated = await updateHabit(
      assigned.trainer.accessToken,
      paused.body.data._id,
      updateBody,
    );
    const replay = await updateHabit(
      assigned.trainer.accessToken,
      paused.body.data._id,
      updateBody,
    );
    const stale = await updateHabit(
      assigned.trainer.accessToken,
      paused.body.data._id,
      {
        ...habitPayload(UUIDS.updateStale, { title: "Dữ liệu cũ" }),
        expectedVersion: 2,
      },
    );
    const clientView = await withAuth(
      request(app).get(`/api/coaching-habits/my?dateKey=${today}`),
      assigned.client.accessToken,
    );
    const versions = await CoachingHabit.find({
      lineageKey: created.body.data.lineageKey,
    })
      .sort({ version: 1 })
      .lean();

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      title: "Đi bộ 30 phút",
      status: "active",
      version: 3,
      isLatest: true,
      schedule: {
        daysOfWeek: [4],
        startDateKey: addDaysToDateKey(
          addDaysToDateKey(today, -60),
          -getAppDayOfWeek(addDaysToDateKey(today, -60)),
        ),
        endDateKey: addDaysToDateKey(
          addDaysToDateKey(
            addDaysToDateKey(today, -60),
            -getAppDayOfWeek(addDaysToDateKey(today, -60)),
          ),
          6,
        ),
      },
    });
    expect(clientView.body.data.items[0].title).toBe("Đi bộ 30 phút");

    expect(replay.body.idempotentReplay).toBe(true);
    expect(stale.status).toBe(409);
    expect(versions).toHaveLength(3);
    expect(versions.at(-1)).toMatchObject({
      title: "Đi bộ 30 phút",
      status: "active",
      isLatest: true,
    });
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
      withinScheduleRange: true,
      currentStreak: 3,
      formulaVersion: "habit-streak-v1",
    });
  });
});
