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
import Recipe from "../../models/Recipe.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import savedMealPlanRoutes from "../../routes/savedMealPlan.routes.js";
import { getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const dateKey = getVietnamDateKey();
const IDS = {
  plan: "a1111111-1111-4111-8111-111111111111",
  assign: "a2222222-2222-4222-8222-222222222222",
  entries: "a3333333-3333-4333-8333-333333333333",
  submit: "a4444444-4444-4444-8444-444444444444",
  correction: "a5555555-5555-4555-8555-555555555555",
  archive: "a6666666-6666-4666-8666-666666666666",
};

const createActiveClient = async (suffix) => {
  const trainer = await createTestUser({
    email: `nutrition-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `nutrition-client-${suffix}@example.com`,
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
  const food = await Food.create({
    label: `Chicken ${suffix}`,
    protein: 20,
    carb: 0,
    fat: 5,
    calories: 125,
  });
  return { client, food };
};

const createPlan = async ({ client, food }, requestId = IDS.plan) => {
  const response = await withAuth(
    request(app).post("/api/saved-meal-plans").send({
      requestId,
      title: "Canonical daily plan",
      meals: [
        {
          key: "meal-1",
          name: "Breakfast",
          type: "breakfast",
          foods: [{ foodId: food._id, amountGrams: 150 }],
        },
      ],
    }),
    client.accessToken,
  );
  expect(response.status).toBe(201);
  return response.body.data;
};

const savePatch = (token, expectedRevision, requestId, patch) =>
  withAuth(
    request(app).put(`/api/daily-journals/${dateKey}`).send({
      expectedRevision,
      requestId,
      patch,
    }),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use("/api/saved-meal-plans", savedMealPlanRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";
  process.env.TODAY_MEAL_PLAN_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
  delete process.env.TODAY_MEAL_PLAN_WRITES_ENABLED;
  await clearCollections();
});

afterAll(teardownTestDB);

describe("Daily Journal nutrition execution", () => {
  it("assigns an exact owned plan version and preserves it after archive", async () => {
    const data = await createActiveClient("assign");
    const plan = await createPlan(data);
    const assigned = await savePatch(
      data.client.accessToken,
      0,
      IDS.assign,
      { nutrition: { assignment: { savedMealPlanId: plan._id } } },
    );
    await withAuth(
      request(app)
        .post(`/api/saved-meal-plans/${plan._id}/archive`)
        .send({ expectedVersion: 1, requestId: IDS.archive }),
      data.client.accessToken,
    );
    const journal = await withAuth(
      request(app).get(`/api/daily-journals/${dateKey}`),
      data.client.accessToken,
    );

    expect(assigned.status).toBe(200);
    expect(journal.body.data.nutrition.assignment).toMatchObject({
      savedMealPlanId: plan._id,
      lineageKey: plan.lineageKey,
      version: 1,
      titleSnapshot: "Canonical daily plan",
    });
  });

  it("rejects assigning another owner's saved plan", async () => {
    const owner = await createActiveClient("owner");
    const outsider = await createActiveClient("outsider");
    const plan = await createPlan(owner);
    const response = await savePatch(
      outsider.client.accessToken,
      0,
      IDS.assign,
      { nutrition: { assignment: { savedMealPlanId: plan._id } } },
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("SAVED_MEAL_PLAN_NOT_FOUND");
  });

  it("canonicalizes follow-plan, published recipe and manual entries", async () => {
    const data = await createActiveClient("entries");
    const plan = await createPlan(data);
    const recipe = await Recipe.create({
      name: "Protein bowl",
      slug: "protein-bowl",
      isPublished: true,
    });
    await savePatch(data.client.accessToken, 0, IDS.assign, {
      nutrition: { assignment: { savedMealPlanId: plan._id } },
    });
    const response = await savePatch(
      data.client.accessToken,
      1,
      IDS.entries,
      {
        nutrition: {
          entries: [
            {
              entryId: "b1111111-1111-4111-8111-111111111111",
              mode: "follow_plan",
              plannedMealKey: "meal-1",
              status: "eaten",
              note: "On plan",
            },
            {
              entryId: "b2222222-2222-4222-8222-222222222222",
              mode: "recipe",
              recipeId: recipe._id,
              status: "eaten",
            },
            {
              entryId: "b3333333-3333-4333-8333-333333333333",
              mode: "manual",
              description: "Ăn nhẹ ngoài kế hoạch",
              status: "eaten",
            },
          ],
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.data.nutrition.entries).toMatchObject([
      { mode: "follow_plan", labelSnapshot: "Breakfast", version: 1 },
      {
        mode: "recipe",
        labelSnapshot: "Protein bowl",
        recipeSlugSnapshot: "protein-bowl",
      },
      { mode: "manual", description: "Ăn nhẹ ngoài kế hoạch" },
    ]);
    expect(JSON.stringify(response.body.data.nutrition)).not.toContain(
      "calories",
    );
  });

  it("rejects duplicate entry IDs and more than 10 entries", async () => {
    const data = await createActiveClient("bounds");
    const duplicate = {
      entryId: "c1111111-1111-4111-8111-111111111111",
      mode: "manual",
      description: "Snack",
      status: "eaten",
    };
    const duplicated = await savePatch(data.client.accessToken, 0, IDS.assign, {
      nutrition: { entries: [duplicate, duplicate] },
    });
    const tooMany = await savePatch(data.client.accessToken, 0, IDS.entries, {
      nutrition: {
        entries: Array.from({ length: 11 }, (_, index) => ({
          ...duplicate,
          entryId: `c0000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      },
    });

    expect(duplicated.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });

  it("requires correction after submit and retains optimistic revision", async () => {
    const data = await createActiveClient("submit");
    await savePatch(data.client.accessToken, 0, IDS.assign, {
      nutrition: {
        entries: [
          {
            entryId: "d1111111-1111-4111-8111-111111111111",
            mode: "manual",
            description: "Dinner",
            status: "eaten",
          },
        ],
      },
    });
    await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      data.client.accessToken,
    );
    const denied = await savePatch(
      data.client.accessToken,
      2,
      IDS.entries,
      { nutrition: { entries: [] } },
    );
    const corrected = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correction,
          reason: "Correct meal history",
          patch: { nutrition: { entries: [] } },
        }),
      data.client.accessToken,
    );

    expect(denied.status).toBe(409);
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.revision).toBe(3);
    expect(corrected.body.data.nutrition.entries).toEqual([]);
  });
});
