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
  getMonthWeekPeriod,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const currentPeriod = getMonthWeekPeriod(today);
const currentWeek = currentPeriod.startDateKey;
const futurePeriodStart = getMonthWeekPeriod(
  addDaysToDateKey(currentPeriod.endDateKey, 1),
).startDateKey;
const monthDateKey = (offset) => {
  const [year, month] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-15`;
};
const historicalPeriodStart = getMonthWeekPeriod(monthDateKey(-2)).startDateKey;
const tooOldPeriodStart = getMonthWeekPeriod(monthDateKey(-4)).startDateKey;
const IDS = {
  save: "91111111-1111-4111-8111-111111111111",
  stale: "92222222-2222-4222-8222-222222222222",
  submit: "93333333-3333-4333-8333-333333333333",
  correction: "94444444-4444-4444-8444-444444444444",
  review: "95555555-5555-4555-8555-555555555555",
  correctionSecond: "96666666-6666-4666-8666-666666666666",
  invalid: "97777777-7777-4777-8777-777777777777",
  correctionNoop: "98888888-8888-4888-8888-888888888888",
  historicalSave: "99999999-9999-4999-8999-999999999999",
  historicalSubmit: "9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  historicalCorrection: "9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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
    bodyFatPercent: 18.5,
    skeletalMusclePercent: 42,
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
      bodyPatch({ bodyFatPercent: 19 }),
    );

    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.data).toMatchObject({
      weekStartDateKey: currentWeek,
      revision: 1,
      status: "draft",
      correctionCount: 0,
      body: {
        weightKg: 72.5,
        bodyFatPercent: 18.5,
        skeletalMusclePercent: 42,
      },
    });
    expect(replay.body.idempotentReplay).toBe(true);
    expect(stale.status).toBe(409);
    expect(await WeeklyCheckin.countDocuments()).toBe(1);
  });

  it("requires a canonical period key and bounds writes to four reporting months", async () => {
    const { client } = await createAssigned("window");
    const nonMonday = await saveCheckin(
      client.accessToken,
      addDaysToDateKey(currentWeek, 1),
      0,
      IDS.save,
    );
    const future = await saveCheckin(
      client.accessToken,
      futurePeriodStart,
      0,
      IDS.stale,
    );
    const historical = await saveCheckin(
      client.accessToken,
      historicalPeriodStart,
      0,
      IDS.submit,
    );
    const tooOld = await saveCheckin(
      client.accessToken,
      tooOldPeriodStart,
      0,
      IDS.invalid,
    );

    expect(nonMonday.status).toBe(400);
    expect(future.status).toBe(422);
    expect(historical.status).toBe(200);
    expect(tooOld.status).toBe(422);
  });

  it("allows one historical submission and rejects every later correction", async () => {
    const { client } = await createAssigned("historical-once");
    const saved = await saveCheckin(
      client.accessToken,
      historicalPeriodStart,
      0,
      IDS.historicalSave,
    );
    const submitted = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${historicalPeriodStart}/submit`)
        .send({
          expectedRevision: saved.body.data.revision,
          requestId: IDS.historicalSubmit,
        }),
      client.accessToken,
    );
    const corrected = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${historicalPeriodStart}/corrections`)
        .send({
          expectedRevision: submitted.body.data.revision,
          requestId: IDS.historicalCorrection,
          reason: "Thử thay đổi báo cáo lịch sử",
          patch: bodyPatch({ weightKg: 71 }),
        }),
      client.accessToken,
    );

    expect(submitted.body.data.status).toBe("submitted");
    expect(corrected.status).toBe(409);
    expect(corrected.body.code).toBe("WEEKLY_CHECKIN_HISTORICAL_LOCKED");
  });

  it("allows exactly one correction, preserves its audit reason and replays it idempotently", async () => {
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
      bodyPatch({ bodyFatPercent: 20 }),
    );
    const corrected = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correction,
          reason: "Điều chỉnh kết quả đo InBody",
          patch: bodyPatch({ bodyFatPercent: 18 }),
        }),
      client.accessToken,
    );
    const replay = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correction,
          reason: "Điều chỉnh kết quả đo InBody",
          patch: bodyPatch({ bodyFatPercent: 18 }),
        }),
      client.accessToken,
    );
    const secondCorrection = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/corrections`)
        .send({
          expectedRevision: 3,
          requestId: IDS.correctionSecond,
          reason: "Thử chỉnh sửa thêm một lần",
          patch: bodyPatch({ bodyFatPercent: 17.5 }),
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
      correctionCount: 1,
      body: { bodyFatPercent: 18 },
    });
    expect(replay.body).toMatchObject({
      idempotentReplay: true,
      data: { revision: 3, correctionCount: 1 },
    });
    expect(secondCorrection.status).toBe(409);
    expect(secondCorrection.body.code).toBe(
      "WEEKLY_CHECKIN_CORRECTION_LIMIT_REACHED",
    );
    expect(revisions.body.data.items[0]).toMatchObject({
      action: "correction",
      reason: "Điều chỉnh kết quả đo InBody",
    });
  });

  it("persists and submits an empty report because every measurement is optional", async () => {
    const { client } = await createAssigned("empty-optional");
    const saved = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.save,
      {
        body: {
          weightKg: null,
          waistCm: null,
          bodyFatPercent: null,
          skeletalMusclePercent: null,
        },
      },
    );
    const submitted = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      client.accessToken,
    );

    expect(saved.body.data).toMatchObject({ revision: 1, status: "draft" });
    expect(submitted.body.data).toMatchObject({
      revision: 2,
      status: "submitted",
      body: {
        weightKg: null,
        waistCm: null,
        bodyFatPercent: null,
        skeletalMusclePercent: null,
      },
    });
    expect(await WeeklyCheckin.countDocuments()).toBe(1);
  });

  it("rejects body composition values outside the 1–80 percent range", async () => {
    const { client } = await createAssigned("body-composition-bounds");

    const belowMinimum = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.save,
      bodyPatch({ bodyFatPercent: 0 }),
    );
    const aboveMaximum = await saveCheckin(
      client.accessToken,
      currentWeek,
      0,
      IDS.invalid,
      bodyPatch({ skeletalMusclePercent: 81 }),
    );

    expect(belowMinimum.status).toBe(400);
    expect(aboveMaximum.status).toBe(400);
    expect(await WeeklyCheckin.countDocuments()).toBe(0);
  });

  it("does not consume the correction when no body measurement changed", async () => {
    const { client } = await createAssigned("correction-noop");
    await saveCheckin(client.accessToken, currentWeek, 0, IDS.save);
    await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      client.accessToken,
    );

    const response = await withAuth(
      request(app)
        .post(`/api/weekly-checkins/${currentWeek}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correctionNoop,
          reason: "Kiểm tra cập nhật không thay đổi",
          patch: bodyPatch(),
        }),
      client.accessToken,
    );
    const stored = await WeeklyCheckin.findOne({
      clientId: client.user._id,
      weekStartDateKey: currentWeek,
    }).lean();

    expect({
      status: response.status,
      code: response.body.code,
      correctionCount: stored.correctionCount,
      revision: stored.revision,
    }).toEqual({
      status: 400,
      code: "EMPTY_WEEKLY_CHECKIN_CORRECTION",
      correctionCount: 0,
      revision: 2,
    });
  });

  it("enforces correctionCount as an integer from zero to one at schema level", async () => {
    const { client } = await createAssigned("invalid-correction-count");
    const invalid = new WeeklyCheckin({
      clientId: client.user._id,
      weekStartDateKey: currentWeek,
      correctionCount: 0.5,
    });

    await expect(invalid.validate()).rejects.toThrow(
      /Số lượt cập nhật phải là số nguyên/,
    );
  });

  it("keeps legacy body fields readable without requiring a data migration", async () => {
    const { client } = await createAssigned("legacy-read");
    await WeeklyCheckin.collection.insertOne({
      clientId: client.user._id,
      weekStartDateKey: currentWeek,
      timeZone: "Asia/Ho_Chi_Minh",
      body: { energy: 7, adherence: 8, wins: "Dữ liệu cũ" },
      status: "submitted",
      submittedAt: new Date(),
      trainerReview: null,
      revision: 2,
      retentionExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await withAuth(
      request(app).get(`/api/weekly-checkins/${currentWeek}`),
      client.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      correctionCount: 0,
      body: { energy: 7, adherence: 8, wins: "Dữ liệu cũ" },
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
