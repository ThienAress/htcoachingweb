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
import Food from "../../models/Food.js";
import Order from "../../models/Order.js";
import SavedMealPlan from "../../models/SavedMealPlan.js";
import savedMealPlanRoutes from "../../routes/savedMealPlan.routes.js";

let app;
const IDS = {
  create: "d1111111-1111-4111-8111-111111111111",
  reused: "d2222222-2222-4222-8222-222222222222",
  revise: "d3333333-3333-4333-8333-333333333333",
  rename: "d3333333-3333-4333-8333-333333333334",
  archive: "d4444444-4444-4444-8444-444444444444",
};

const createActiveClient = async (suffix) => {
  const trainer = await createTestUser({
    email: "meal-plan-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "meal-plan-client-" + suffix + "@example.com",
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

const createFoods = async () => {
  const chicken = await Food.create({
    label: "Chicken",
    protein: 20,
    carb: 0,
    fat: 5,
    calories: 125,
  });
  const rice = await Food.create({
    label: "Rice",
    protein: 2,
    carb: 28,
    fat: 0.3,
    calories: 122.7,
  });
  return { chicken, rice };
};

const payloadFor = ({ chicken, rice }, overrides = {}) => ({
  requestId: IDS.create,
  title: "Meal plan giảm mỡ",
  target: {
    label: "Giảm mỡ",
    protein: 120,
    carb: 180,
    fat: 50,
    calories: 1650,
  },
  meals: [
    {
      key: "meal-1",
      name: "Bữa 1",
      type: "breakfast",
      foods: [
        { foodId: chicken._id, amountGrams: 150 },
        { foodId: rice._id, amountGrams: 200 },
      ],
    },
  ],
  claimedTotals: { protein: 9999, calories: 1 },
  ...overrides,
});

const postPlan = (token, body) =>
  withAuth(request(app).post("/api/saved-meal-plans").send(body), token);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/saved-meal-plans", savedMealPlanRoutes);
  app.use(errorHandler);
  await Promise.all([Food.init(), Order.init(), SavedMealPlan.init()]);
});

beforeEach(() => {
  process.env.TODAY_MEAL_PLAN_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_MEAL_PLAN_WRITES_ENABLED;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Saved Meal Plan command contract", () => {
  it("enforces the 30-character clean title policy", async () => {
    const { client } = await createActiveClient("title-policy");
    const foods = await createFoods();

    const tooLong = await postPlan(
      client.accessToken,
      payloadFor(foods, { title: "a".repeat(31) }),
    );
    const prohibited = await postPlan(
      client.accessToken,
      payloadFor(foods, {
        requestId: IDS.reused,
        title: "Thực đơn xhct",
      }),
    );

    expect(tooLong.status).toBe(400);
    expect(prohibited.status).toBe(400);
    expect(prohibited.body.code).toBe("INVALID_SAVED_MEAL_PLAN_TITLE");
  });

  it("recalculates canonical nutrition and replays create exactly once", async () => {
    const { client, trainer } = await createActiveClient("create");
    const foods = await createFoods();
    const payload = payloadFor(foods);

    const created = await postPlan(client.accessToken, payload);
    const replayed = await postPlan(client.accessToken, payload);

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      version: 1,
      isLatest: true,
      status: "active",
      totals: {
        protein: 34,
        carb: 56,
        fat: 8.1,
        calories: 432.9,
      },
      meals: [
        {
          foods: [
            { label: "Chicken", amountGrams: 150 },
            { label: "Rice", amountGrams: 200 },
          ],
        },
      ],
    });
    expect(created.body.data.trainerIdAtCreation).toBe(
      String(trainer.user._id),
    );
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(await SavedMealPlan.countDocuments()).toBe(1);
  });

  it("rejects missing Food IDs and requestId reuse with another payload", async () => {
    const { client } = await createActiveClient("invalid");
    const foods = await createFoods();
    const payload = payloadFor(foods);
    await postPlan(client.accessToken, payload);

    const reused = await postPlan(client.accessToken, {
      ...payload,
      title: "Payload khác",
    });
    const missing = await postPlan(client.accessToken, {
      ...payload,
      requestId: IDS.reused,
      meals: [
        {
          ...payload.meals[0],
          foods: [
            {
              foodId: new SavedMealPlan()._id,
              amountGrams: 100,
            },
          ],
        },
      ],
    });

    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("REQUEST_ID_REUSED");
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe("MEAL_PLAN_FOOD_NOT_FOUND");
  });

  it("creates an immutable revision and keeps the old version readable", async () => {
    const { client } = await createActiveClient("revise");
    const foods = await createFoods();
    const created = await postPlan(
      client.accessToken,
      payloadFor(foods),
    );
    const firstId = created.body.data._id;
    const revisionPayload = payloadFor(foods, {
      requestId: IDS.revise,
      expectedVersion: 1,
      title: "Meal plan giảm mỡ v2",
      meals: [
        {
          ...payloadFor(foods).meals[0],
          foods: [
            { foodId: foods.chicken._id, amountGrams: 100 },
          ],
        },
      ],
    });

    const revised = await withAuth(
      request(app)
        .post("/api/saved-meal-plans/" + firstId + "/revisions")
        .send(revisionPayload),
      client.accessToken,
    );
    const oldVersion = await withAuth(
      request(app).get("/api/saved-meal-plans/" + firstId),
      client.accessToken,
    );
    const list = await withAuth(
      request(app).get("/api/saved-meal-plans"),
      client.accessToken,
    );

    expect(revised.body.data).toMatchObject({
      version: 2,
      title: "Meal plan giảm mỡ v2",
      totals: { protein: 20, carb: 0, fat: 5, calories: 125 },
    });
    expect(oldVersion.body.data).toMatchObject({
      version: 1,
      status: "superseded",
      totals: { calories: 432.9 },
    });
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].version).toBe(2);
  });

  it("renames through an immutable snapshot even when a Food was removed", async () => {
    const { client } = await createActiveClient("rename");
    const foods = await createFoods();
    const created = await postPlan(client.accessToken, payloadFor(foods));
    await Food.deleteMany({});

    const renamed = await withAuth(
      request(app)
        .patch(`/api/saved-meal-plans/${created.body.data._id}/title`)
        .send({
          requestId: IDS.rename,
          expectedVersion: 1,
          title: "Ngày tập chân",
        }),
      client.accessToken,
    );
    const replayed = await withAuth(
      request(app)
        .patch(`/api/saved-meal-plans/${created.body.data._id}/title`)
        .send({
          requestId: IDS.rename,
          expectedVersion: 1,
          title: "Ngày tập chân",
        }),
      client.accessToken,
    );
    const oldSnapshot = await withAuth(
      request(app).get(`/api/saved-meal-plans/${created.body.data._id}`),
      client.accessToken,
    );

    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({
      title: "Ngày tập chân",
      version: 2,
      totals: created.body.data.totals,
    });
    expect(replayed.status).toBe(200);
    expect(replayed.body).toMatchObject({
      idempotentReplay: true,
      data: { _id: renamed.body.data._id, version: 2 },
    });
    expect(oldSnapshot.body.data.status).toBe("superseded");
  });

  it("blocks IDOR, missing CSRF and disabled writes without requiring active coaching", async () => {
    const { client } = await createActiveClient("owner");
    const outsider = await createActiveClient("outsider");
    const foods = await createFoods();
    const created = await postPlan(client.accessToken, payloadFor(foods));
    const planId = created.body.data._id;

    const idor = await withAuth(
      request(app).get("/api/saved-meal-plans/" + planId),
      outsider.client.accessToken,
    );
    const noCsrf = await request(app)
      .post("/api/saved-meal-plans")
      .set("Cookie", ["accessToken=" + client.accessToken])
      .send(payloadFor(foods, { requestId: IDS.reused }));
    const guest = await request(app)
      .post("/api/saved-meal-plans")
      .send(payloadFor(foods, { requestId: IDS.reused }));
    process.env.TODAY_MEAL_PLAN_WRITES_ENABLED = "false";
    const disabled = await postPlan(
      client.accessToken,
      payloadFor(foods, { requestId: IDS.reused }),
    );
    process.env.TODAY_MEAL_PLAN_WRITES_ENABLED = "true";
    await Order.updateMany(
      { userId: client.user._id },
      { $set: { sessions: 0 } },
    );
    const inactive = await postPlan(
      client.accessToken,
      payloadFor(foods, { requestId: IDS.reused }),
    );

    expect(idor.status).toBe(404);
    expect(noCsrf.status).toBe(403);
    expect(guest.status).toBe(401);
    expect(disabled.status).toBe(503);
    expect(inactive.status).toBe(201);
    expect(inactive.body.data.trainerIdAtCreation).toBeNull();
  });

  it("allows an authenticated owner without an Order to create, revise and archive", async () => {
    const owner = await createTestUser({
      email: "meal-plan-owner-without-order@example.com",
    });
    const foods = await createFoods();
    const created = await postPlan(owner.accessToken, payloadFor(foods));

    const revised = await withAuth(
      request(app)
        .post("/api/saved-meal-plans/" + created.body.data._id + "/revisions")
        .send(
          payloadFor(foods, {
            requestId: IDS.revise,
            expectedVersion: 1,
            title: "Thực đơn cá nhân đã cập nhật",
          }),
        ),
      owner.accessToken,
    );
    const archived = await withAuth(
      request(app)
        .post(
          "/api/saved-meal-plans/" + revised.body.data._id + "/archive",
        )
        .send({ expectedVersion: 2, requestId: IDS.archive }),
      owner.accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.data.trainerIdAtCreation).toBeNull();
    expect(revised.status).toBe(200);
    expect(archived.body.data.status).toBe("archived");
  });

  it("archives only the latest owned version", async () => {
    const { client } = await createActiveClient("archive");
    const foods = await createFoods();
    const created = await postPlan(client.accessToken, payloadFor(foods));

    const archived = await withAuth(
      request(app)
        .post(
          "/api/saved-meal-plans/" + created.body.data._id + "/archive",
        )
        .send({ expectedVersion: 1, requestId: IDS.archive }),
      client.accessToken,
    );

    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("archived");
    expect(archived.body.data.archivedAt).toBeTruthy();
  });
});
