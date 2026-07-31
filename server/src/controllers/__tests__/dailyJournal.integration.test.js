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

  it("submits idempotently and requires a reason for post-submit correction", async () => {
    const { client } = await createActiveClient("submit");
    const dateKey = getVietnamDateKey();
    await putJournal(client.accessToken, dateKey, {
      expectedRevision: 0,
      requestId: requestIds.create,
      patch: { wellness: { energy: 5, pain: 7 } },
    });

    const submitted = await postAction(
      client.accessToken,
      dateKey,
      "submit",
      { expectedRevision: 1, requestId: requestIds.submit },
    );
    const replayed = await postAction(
      client.accessToken,
      dateKey,
      "submit",
      { expectedRevision: 1, requestId: requestIds.submit },
    );
    const missingReason = await postAction(
      client.accessToken,
      dateKey,
      "corrections",
      {
        expectedRevision: 2,
        requestId: requestIds.correction,
        patch: { wellness: { pain: 4 } },
      },
    );
    const corrected = await postAction(
      client.accessToken,
      dateKey,
      "corrections",
      {
        expectedRevision: 2,
        requestId: requestIds.correction,
        reason: "Cập nhật sau khi theo dõi lại",
        patch: { wellness: { pain: 4 } },
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
      revision: 2,
      status: "submitted",
    });
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(missingReason.status).toBe(400);
    expect(corrected.body.data).toMatchObject({
      revision: 3,
      status: "submitted",
      wellness: { pain: 4 },
    });
    expect(await DailyJournalRevision.countDocuments()).toBe(3);
    expect(revisions.body.data.items.map((item) => item.action)).toEqual([
      "correction",
      "submit",
      "create",
    ]);
    expect(timeline.body.data.map((item) => item.action)).toEqual([
      "correction",
      "submit",
      "create",
    ]);
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
    expect(response.body.code).toBe("NO_ACTIVE_ORDER");
  });
});
