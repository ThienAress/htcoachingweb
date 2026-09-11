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
import DailyJournal from "../../models/DailyJournal.js";
import DailyJournalRevision from "../../models/DailyJournalRevision.js";
import InAppNotification from "../../models/InAppNotification.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import Order from "../../models/Order.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import {
  addDaysToDateKey,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;

const requestIds = {
  create: "b1111111-1111-4111-8111-111111111111",
  update: "b2222222-2222-4222-8222-222222222222",
  stale: "b3333333-3333-4333-8333-333333333333",
  submit: "b4444444-4444-4444-8444-444444444444",
  correction: "b5555555-5555-4555-8555-555555555555",
  correctionSecond: "b6666666-6666-4666-8666-666666666666",
  correctionNoop: "b7777777-7777-4777-8777-777777777777",
};

const createActiveClient = async (suffix) => {
  const trainer = await createTestUser({
    email: "journal-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "journal-client-" + suffix + "@example.com",
  });
  await Order.create({
    userId: client.user._id,
    trainerId: trainer.user._id,
    name: client.user.name,
    email: client.user.email,
    package: "PT 10",
    sessions: 10,
    totalSessions: 10,
    status: "approved",
  });
  return { client, trainer };
};

const putJournal = (token, dateKey, body) =>
  withAuth(
    request(app).put("/api/daily-journals/" + dateKey).send(body),
    token,
  );

const postAction = (token, dateKey, action, body) =>
  withAuth(
    request(app)
      .post("/api/daily-journals/" + dateKey + "/" + action)
      .send(body),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use(errorHandler);
  await Promise.all([
    DailyJournal.init(),
    DailyJournalRevision.init(),
    InAppNotification.init(),
    Order.init(),
  ]);
});

beforeEach(() => {
  process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Daily Journal mutation contract", () => {
  it("creates an owned draft and replays the same request exactly once", async () => {
    const { client, trainer } = await createActiveClient("create");
    const dateKey = getVietnamDateKey();
    const body = {
      expectedRevision: 0,
      requestId: requestIds.create,
      patch: {
        wellness: { sleepHours: 7.5, energy: 8, pain: 2 },
        notes: { private: "Ngủ tốt", shared: "Sẵn sàng tập" },
      },
    };

    const created = await putJournal(client.accessToken, dateKey, body);
    const replayed = await putJournal(client.accessToken, dateKey, body);

    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      dateKey,
      revision: 1,
      status: "draft",
      wellness: { sleepHours: 7.5, energy: 8, pain: 2 },
      notes: { private: "Ngủ tốt", shared: "Sẵn sàng tập" },
    });
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(await DailyJournal.countDocuments()).toBe(1);
    expect(await DailyJournalRevision.countDocuments()).toBe(1);
    expect(
      String((await DailyJournal.findOne()).trainerIdAtCreation),
    ).toBe(String(trainer.user._id));
  });

  it("rejects stale revisions and requestId reuse with a different payload", async () => {
    const { client } = await createActiveClient("conflict");
    const dateKey = getVietnamDateKey();
    await putJournal(client.accessToken, dateKey, {
      expectedRevision: 0,
      requestId: requestIds.create,
      patch: { wellness: { energy: 5 } },
    });

    const reused = await putJournal(client.accessToken, dateKey, {
      expectedRevision: 1,
      requestId: requestIds.create,
      patch: { wellness: { energy: 7 } },
    });
    const stale = await putJournal(client.accessToken, dateKey, {
      expectedRevision: 0,
      requestId: requestIds.stale,
      patch: { wellness: { energy: 6 } },
    });

    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("REQUEST_ID_REUSED");
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("STALE_REVISION");
    expect(await DailyJournalRevision.countDocuments()).toBe(1);
  });

  it("atomically submits form data and allows exactly one correction", async () => {
    const { client } = await createActiveClient("submit");
    const dateKey = getVietnamDateKey();

    const submitted = await postAction(
      client.accessToken,
      dateKey,
      "submit",
      {
        expectedRevision: 0,
        requestId: requestIds.submit,
        patch: { wellness: { energy: 5, pain: 7 } },
      },
    );
    const replayed = await postAction(
      client.accessToken,
      dateKey,
      "submit",
      {
        expectedRevision: 0,
        requestId: requestIds.submit,
        patch: { wellness: { energy: 5, pain: 7 } },
      },
    );
    const corrected = await postAction(
      client.accessToken,
      dateKey,
      "corrections",
      {
        expectedRevision: 1,
        requestId: requestIds.correction,
        patch: { wellness: { pain: 4 } },
      },
    );
    const secondCorrection = await postAction(
      client.accessToken,
      dateKey,
      "corrections",
      {
        expectedRevision: 2,
        requestId: requestIds.correctionSecond,
        patch: { wellness: { pain: 3 } },
      },
    );
    const revisions = await withAuth(
      request(app).get(
        "/api/daily-journals/" + dateKey + "/revisions",
      ),
      client.accessToken,
    );
    const timeline = await withAuth(
      request(app).get(
        "/api/daily-journals/" + dateKey + "/timeline",
      ),
      client.accessToken,
    );

    expect(submitted.body.data).toMatchObject({
      revision: 1,
      status: "submitted",
      correctionCount: 0,
      wellness: { energy: 5, pain: 7 },
    });
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(corrected.body.data).toMatchObject({
      revision: 2,
      status: "submitted",
      correctionCount: 1,
      wellness: { pain: 4 },
    });
    expect(secondCorrection.status).toBe(409);
    expect(secondCorrection.body.code).toBe("JOURNAL_CORRECTION_LIMIT_REACHED");
    expect(await DailyJournalRevision.countDocuments()).toBe(2);
    expect(revisions.body.data.items.map((item) => item.action)).toEqual([
      "correction",
      "submit",
    ]);
    expect(timeline.body.data.map((item) => item.action)).toEqual([
      "correction",
      "submit",
    ]);
  });

  it("does not consume the correction or notify the trainer when nothing changed", async () => {
    const { client } = await createActiveClient("correction-noop");
    const dateKey = getVietnamDateKey();

    await postAction(client.accessToken, dateKey, "submit", {
      expectedRevision: 0,
      requestId: requestIds.submit,
      patch: { wellness: { energy: 5, pain: 2 } },
    });
    const response = await postAction(
      client.accessToken,
      dateKey,
      "corrections",
      {
        expectedRevision: 1,
        requestId: requestIds.correctionNoop,
        patch: { wellness: { energy: 5, pain: 2 } },
      },
    );
    const stored = await DailyJournal.findOne({ dateKey }).lean();

    expect({
      status: response.status,
      code: response.body.code,
      revision: stored.revision,
      correctionCount: stored.correctionCount,
      revisions: await DailyJournalRevision.countDocuments(),
      notifications: await InAppNotification.countDocuments(),
    }).toEqual({
      status: 400,
      code: "EMPTY_DAILY_JOURNAL_CORRECTION",
      revision: 1,
      correctionCount: 0,
      revisions: 1,
      notifications: 1,
    });
  });

  it("fails closed for missing CSRF, disabled writes, invalid values and edit window", async () => {
    const { client } = await createActiveClient("guard");
    const today = getVietnamDateKey();
    const payload = {
      expectedRevision: 0,
      requestId: requestIds.create,
      patch: { wellness: { pain: 11 } },
    };

    const noCsrf = await request(app)
      .put("/api/daily-journals/" + today)
      .set("Cookie", ["accessToken=" + client.accessToken])
      .send(payload);
    const invalid = await putJournal(client.accessToken, today, payload);
    const expired = await putJournal(
      client.accessToken,
      addDaysToDateKey(today, -8),
      {
        ...payload,
        requestId: requestIds.update,
        patch: { wellness: { pain: 2 } },
      },
    );
    process.env.TODAY_JOURNAL_WRITES_ENABLED = "false";
    const disabled = await putJournal(client.accessToken, today, {
      ...payload,
      patch: { wellness: { pain: 2 } },
    });

    expect(noCsrf.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(expired.status).toBe(422);
    expect(expired.body.code).toBe("JOURNAL_EDIT_WINDOW_CLOSED");
    expect(disabled.status).toBe(503);
    expect(await DailyJournal.countDocuments()).toBe(0);
  });

  it("blocks journal mutation without an active coaching assignment", async () => {
    const client = await createTestUser({
      email: "journal-no-order@example.com",
    });

    const response = await putJournal(
      client.accessToken,
      getVietnamDateKey(),
      {
        expectedRevision: 0,
        requestId: requestIds.create,
        patch: { wellness: { stress: 3 } },
      },
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("JOURNAL_ENTITLEMENT_REQUIRED");
  });

  it("does not treat a trainer with Fitness+ as a customer dashboard user", async () => {
    const trainer = await createTestUser({
      email: "journal-trainer-fitness-role@example.com",
      role: "trainer",
    });
    await FitnessSubscription.create({
      userId: trainer.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
    });

    const response = await putJournal(
      trainer.accessToken,
      getVietnamDateKey(),
      {
        expectedRevision: 0,
        requestId: "c4444444-4444-4444-8444-444444444444",
        patch: { wellness: { stress: 3 } },
      },
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("JOURNAL_ENTITLEMENT_REQUIRED");
  });

  it("lets HT Fitness+ users self-save without creating trainer reports", async () => {
    const client = await createTestUser({
      email: "journal-fitness-self-managed@example.com",
    });
    await FitnessSubscription.create({
      userId: client.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
    });
    const dateKey = getVietnamDateKey();
    const saved = await putJournal(client.accessToken, dateKey, {
      expectedRevision: 0,
      requestId: "c1111111-1111-4111-8111-111111111111",
      patch: {
        wellness: { energy: 7, stress: 3 },
        notes: { shared: "Không được chuyển thành báo cáo HLV" },
      },
    });
    const submitted = await postAction(
      client.accessToken,
      dateKey,
      "submit",
      {
        expectedRevision: 1,
        requestId: "c2222222-2222-4222-8222-222222222222",
        patch: { wellness: { energy: 8 } },
      },
    );
    const journal = await DailyJournal.findOne({ clientId: client.user._id });

    expect(saved.status).toBe(200);
    expect(saved.body.data.notes.shared).toBe("");
    expect(journal.trainerIdAtCreation).toBeNull();
    expect(submitted.status).toBe(403);
    expect(submitted.body.code).toBe("SELF_MANAGED_JOURNAL_ACTION_FORBIDDEN");
    expect(await InAppNotification.countDocuments()).toBe(0);
  });

  it("rejects an idempotent replay after the Fitness+ entitlement expires", async () => {
    const client = await createTestUser({
      email: "journal-fitness-expired-replay@example.com",
    });
    const subscription = await FitnessSubscription.create({
      userId: client.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
    });
    const dateKey = getVietnamDateKey();
    const body = {
      expectedRevision: 0,
      requestId: "c5555555-5555-4555-8555-555555555555",
      patch: { wellness: { energy: 7 } },
    };

    const saved = await putJournal(client.accessToken, dateKey, body);
    await FitnessSubscription.updateOne(
      { _id: subscription._id },
      { $set: { status: "expired" } },
    );
    const replay = await putJournal(client.accessToken, dateKey, body);

    expect(saved.status).toBe(200);
    expect(replay.status).toBe(403);
    expect(replay.body.code).toBe("JOURNAL_ENTITLEMENT_REQUIRED");
    expect(await DailyJournalRevision.countDocuments()).toBe(1);
  });

  it("converts a prior coaching submission to a self-managed draft on save", async () => {
    const client = await createTestUser({
      email: "journal-fitness-transition@example.com",
    });
    await FitnessSubscription.create({
      userId: client.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      amount: 99000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "active",
    });
    const dateKey = getVietnamDateKey();
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: client.user._id,
      dateKey,
      status: "submitted",
      submittedAt: new Date(),
      correctionCount: 1,
      nutrition: { submittedAt: new Date() },
      wellness: { energy: 5 },
      revision: 2,
    });

    const response = await putJournal(client.accessToken, dateKey, {
      expectedRevision: 2,
      requestId: "c3333333-3333-4333-8333-333333333333",
      patch: { wellness: { energy: 9 } },
    });
    const journal = await DailyJournal.findOne({ clientId: client.user._id });

    expect(response.status).toBe(200);
    expect(journal).toMatchObject({
      status: "draft",
      submittedAt: null,
      correctionCount: 0,
      revision: 3,
      wellness: { energy: 9 },
      nutrition: { submittedAt: null },
    });
    expect(await InAppNotification.countDocuments()).toBe(0);
  });
});
