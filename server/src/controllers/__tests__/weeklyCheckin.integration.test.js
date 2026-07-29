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
import Order from "../../models/Order.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../../models/WeeklyCheckinRevision.js";
import weeklyCheckinRoutes from "../../routes/weeklyCheckin.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const currentWeek = addDaysToDateKey(today, -getAppDayOfWeek(today));
const IDS = {
  save: "91111111-1111-4111-8111-111111111111",
  stale: "92222222-2222-4222-8222-222222222222",
  submit: "93333333-3333-4333-8333-333333333333",
  correction: "94444444-4444-4444-8444-444444444444",
  review: "95555555-5555-4555-8555-555555555555",
};

const createAssigned = async (suffix) => {
  const trainer = await createTestUser({
    email: `weekly-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `weekly-client-${suffix}@example.com`,
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

const bodyPatch = (overrides = {}) => ({
  body: {
    weightKg: 72.5,
    waistCm: 82,
    energy: 8,
    adherence: 7,
    wins: "Tập đủ lịch",
    challenges: "Ngủ muộn một hôm",
    note: "Tuần này cảm thấy ổn",
    ...overrides,
  },
});

const saveCheckin = (
  token,
  weekStartDateKey,
  expectedRevision,
  requestId,
  patch = bodyPatch(),
) =>
  withAuth(
    request(app)
      .put(`/api/weekly-checkins/${weekStartDateKey}`)
      .send({ expectedRevision, requestId, patch }),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/weekly-checkins", weeklyCheckinRoutes);
  app.use(errorHandler);
  await Promise.all([WeeklyCheckin.init(), WeeklyCheckinRevision.init()]);
});

beforeEach(() => {
  process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Weekly Check-in lifecycle", () => {
  it("saves one canonical Monday check-in idempotently and rejects stale writes", async () => {
    const { client } = await createAssigned("save");
    const created = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.save,
    );
    const replay = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.save,
    );
    const stale = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.stale,
      bodyPatch({ energy: 4 }),
    );

    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.data).toMatchObject({
      weekStartDateKey: currentWeek,
      revision: 1,
      status: "draft",
      body: { weightKg: 72.5, energy: 8 },
    });
    expect(replay.body.idempotentReplay).toBe(true);
    expect(stale.status).toBe(409);
    expect(await WeeklyCheckin.countDocuments()).toBe(1);
  });

  it("requires Monday and bounds writes to current or previous week", async () => {
    const { client } = await createAssigned("window");
    const nonMonday = await saveCheckin(
      client.accessToken,
      addDaysToDateKey(currentWeek, 1),
      0,
      IDS.save,
    );
    const future = await saveCheckin(
      client.accessToken,
      addDaysToDateKey(currentWeek, 7),
      0,
      IDS.stale,
    );
    const old = await saveCheckin(
      client.accessToken,
      addDaysToDateKey(currentWeek, -14),
      0,
      IDS.submit,
    );

    expect(nonMonday.status).toBe(400);
    expect(future.status).toBe(422);
    expect(old.status).toBe(422);
  });

  it("protects submitted client fields and records correction reason", async () => {
    const { client } = await createAssigned("correction");
    await saveCheckin(client.accessToken, currentWeek, 0, IDS.save);
    const submitted = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      client.accessToken,
    );
    const denied = await saveCheckin(
      client.accessToken,
      currentWeek,
      2,
      IDS.stale,
      bodyPatch({ note: "Overwrite" }),
    );
    const corrected = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correction,
          reason: "Correct weekly note",
          patch: bodyPatch({ note: "Corrected note" }),
        }),
      client.accessToken,
    );
    const revisions = await withAuth(
      request(app).get(`/api/weekly-checkins/${currentWeek}/revisions`),
      client.accessToken,
    );

    expect(submitted.body.data.status).toBe("submitted");
    expect(denied.status).toBe(409);
    expect(corrected.body.data).toMatchObject({
      revision: 3,
      status: "submitted",
      body: { note: "Corrected note" },
    });
    expect(revisions.body.data.items[0]).toMatchObject({
      action: "correction",
      reason: "Correct weekly note",
    });
  });

  it("lets only the active trainer review without mutating client fields", async () => {
    const assigned = await createAssigned("review");
    const outsider = await createAssigned("outsider");
    await saveCheckin(assigned.client.accessToken, currentWeek, 0, IDS.save);
    await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      assigned.client.accessToken,
    );
    const reviewPayload = {
      expectedRevision: 2,
      requestId: IDS.review,
      review: { message: "Tiếp tục giữ lịch ngủ", rating: 8 },
    };
    const reviewed = await withAuth(
      request(app)
        .post(
          `/api/weekly-checkins/trainer/clients/${assigned.client.user._id}/${currentWeek}/review`,
        )
        .send(reviewPayload),
      assigned.trainer.accessToken,
    );
    const denied = await withAuth(
      request(app)
        .post(
          `/api/weekly-checkins/trainer/clients/${assigned.client.user._id}/${currentWeek}/review`,
        )
        .send(reviewPayload),
      outsider.trainer.accessToken,
    );
    const ownershipViolation = await withAuth(
      request(app)
        .post(
          `/api/weekly-checkins/trainer/clients/${assigned.client.user._id}/${currentWeek}/review`,
        )
        .send({ ...reviewPayload, body: { weightKg: 1 } }),
      assigned.trainer.accessToken,
    );

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({
      status: "reviewed",
      revision: 3,
      body: { weightKg: 72.5 },
      trainerReview: { message: "Tiếp tục giữ lịch ngủ", rating: 8 },
    });
    expect(denied.status).toBe(403);
    expect(ownershipViolation.status).toBe(400);
  });

  it("allows inactive clients to read own history but removes trainer access", async () => {
    const assigned = await createAssigned("inactive");
    await saveCheckin(assigned.client.accessToken, currentWeek, 0, IDS.save);
    await Order.updateMany(
      { userId: assigned.client.user._id },
      { $set: { sessions: 0 } },
    );
    const own = await withAuth(
      request(app).get(`/api/weekly-checkins/${currentWeek}`),
      assigned.client.accessToken,
    );
    const trainer = await withAuth(
      request(app).get(
        `/api/weekly-checkins/trainer/clients/${assigned.client.user._id}/${currentWeek}`,
      ),
      assigned.trainer.accessToken,
    );

    expect(own.status).toBe(200);
    expect(trainer.status).toBe(403);
  });
});
