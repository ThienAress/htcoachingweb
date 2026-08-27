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
import InAppNotification from "../../models/InAppNotification.js";
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
  manualCreate: "a7777777-7777-4777-8777-777777777777",
  manualEdit: "a8888888-8888-4888-8888-888888888888",
  manualEditAgain: "a9999999-9999-4999-8999-999999999999",
  manualTamper: "b1111111-1111-4111-8111-111111111111",
  adjust: "b2222222-2222-4222-8222-222222222222",
  eatAdjusted: "b3333333-3333-4333-8333-333333333333",
  nutritionSubmit: "b4444444-4444-4444-8444-444444444444",
  nutritionSubmitAgain: "b5555555-5555-4555-8555-555555555555",
  nutritionLockedUpdate: "b6666666-6666-4666-8666-666666666666",
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
  return { client, trainer, food };
};

const createPlan = async (
  { client, food },
  requestId = IDS.plan,
  amountGrams = 150,
) => {
  const response = await withAuth(
    request(app).post("/api/saved-meal-plans").send({
      requestId,
      title: "Canonical daily plan",
      meals: [
        {
          key: "meal-1",
          name: "Breakfast",
          type: "breakfast",
          foods: [{ foodId: food._id, amountGrams }],
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
    expect(response.body.data.nutrition.entries[0].actualTotals).toMatchObject({
      protein: 30,
      carb: 0,
      fat: 7.5,
      calories: 187.5,
    });
  });

  it("scales a canonical 250g food snapshot to 150g and only totals eaten meals", async () => {
    const data = await createActiveClient("actual-grams");
    const plan = await createPlan(data, IDS.plan, 250);
    await savePatch(data.client.accessToken, 0, IDS.assign, {
      nutrition: { assignment: { savedMealPlanId: plan._id } },
    });
    const adjusted = await savePatch(
      data.client.accessToken,
      1,
      IDS.adjust,
      {
        nutrition: {
          entries: [
            {
              entryId: "c2222222-2222-4222-8222-222222222222",
              mode: "follow_plan",
              plannedMealKey: "meal-1",
              status: "changed",
              adjustments: [
                { foodId: data.food._id, amountGrams: 150 },
              ],
            },
          ],
        },
      },
    );
    const eaten = await savePatch(
      data.client.accessToken,
      2,
      IDS.eatAdjusted,
      {
        nutrition: {
          entries: [
            {
              entryId: "c2222222-2222-4222-8222-222222222222",
              mode: "follow_plan",
              plannedMealKey: "meal-1",
              status: "eaten",
              adjustments: [
                { foodId: data.food._id, amountGrams: 150 },
              ],
            },
          ],
        },
      },
    );

    expect(adjusted.status).toBe(200);
    expect(adjusted.body.data.nutrition.entries[0]).toMatchObject({
      status: "changed",
      actualFoods: [
        {
          labelSnapshot: `Chicken actual-grams`,
          plannedAmountGrams: 250,
          actualAmountGrams: 150,
          nutrition: { protein: 30, carb: 0, fat: 7.5, calories: 187.5 },
        },
      ],
      actualTotals: { protein: 30, carb: 0, fat: 7.5, calories: 187.5 },
    });
    expect(adjusted.body.data.nutrition.dailyTotals).toEqual({
      protein: 0,
      carb: 0,
      fat: 0,
      calories: 0,
    });
    expect(eaten.body.data.nutrition.dailyTotals).toEqual({
      protein: 30,
      carb: 0,
      fat: 7.5,
      calories: 187.5,
    });
    expect(eaten.body.data.nutrition.assignment.totalsSnapshot).toEqual({
      protein: 50,
      carb: 0,
      fat: 12.5,
      calories: 312.5,
    });
  });

  it("rejects client-owned nutrition snapshots and macro totals", async () => {
    const data = await createActiveClient("snapshot-tamper");
    const plan = await createPlan(data);
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
              entryId: "c3333333-3333-4333-8333-333333333333",
              mode: "follow_plan",
              plannedMealKey: "meal-1",
              status: "eaten",
              adjustments: [
                {
                  foodId: data.food._id,
                  amountGrams: 150,
                  calories: 1,
                },
              ],
              actualTotals: { calories: 1 },
            },
          ],
        },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_JOURNAL_NUTRITION");
  });

  it("submits nutrition once, replays safely and locks later nutrition mutations", async () => {
    const data = await createActiveClient("submit-nutrition");
    const plan = await createPlan(data);
    await savePatch(data.client.accessToken, 0, IDS.assign, {
      nutrition: { assignment: { savedMealPlanId: plan._id } },
    });
    await savePatch(data.client.accessToken, 1, IDS.entries, {
      nutrition: {
        entries: [
          {
            entryId: "c4444444-4444-4444-8444-444444444444",
            mode: "follow_plan",
            plannedMealKey: "meal-1",
            status: "eaten",
          },
        ],
      },
    });
    const submitPayload = {
      expectedRevision: 2,
      requestId: IDS.nutritionSubmit,
    };
    const submitted = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/nutrition/submit`)
        .send(submitPayload),
      data.client.accessToken,
    );
    const replay = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/nutrition/submit`)
        .send(submitPayload),
      data.client.accessToken,
    );
    const submittedAgain = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/nutrition/submit`)
        .send({
          expectedRevision: 3,
          requestId: IDS.nutritionSubmitAgain,
        }),
      data.client.accessToken,
    );
    const locked = await savePatch(
      data.client.accessToken,
      3,
      IDS.nutritionLockedUpdate,
      { nutrition: { entries: [] } },
    );

    expect(submitted.status).toBe(200);
    expect(submitted.body.data.nutrition.submittedAt).toBeTruthy();
    expect(submitted.body.data.status).toBe("draft");
    expect(
      await InAppNotification.findOne({
        recipientId: data.trainer.user._id,
        type: "nutrition_submitted",
      }).lean(),
    ).toMatchObject({
      title: expect.stringContaining("đã gửi báo cáo dinh dưỡng"),
      deepLink:
        `/trainer/clients/${data.client.user._id}` +
        `?tab=tasks&date=${dateKey}#nutrition-report`,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(submittedAgain.status).toBe(409);
    expect(submittedAgain.body.code).toBe("NUTRITION_ALREADY_SUBMITTED");
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe("NUTRITION_ALREADY_SUBMITTED");
  });

  it("keeps nutrition editable until its own submit even after wellness is submitted", async () => {
    const data = await createActiveClient("independent-lifecycle");
    await savePatch(data.client.accessToken, 0, IDS.assign, {
      wellness: { energy: 7 },
    });
    await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/submit`)
        .send({ expectedRevision: 1, requestId: IDS.submit }),
      data.client.accessToken,
    );
    const nutritionUpdate = await savePatch(
      data.client.accessToken,
      2,
      IDS.manualCreate,
      {
        nutrition: {
          entries: [
            {
              entryId: "c5555555-5555-4555-8555-555555555555",
              mode: "manual",
              mealName: "Bữa phụ",
              description: "Một quả chuối",
              status: "eaten",
            },
          ],
        },
      },
    );
    const nutritionSubmit = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/nutrition/submit`)
        .send({ expectedRevision: 3, requestId: IDS.nutritionSubmit }),
      data.client.accessToken,
    );

    expect(nutritionUpdate.status).toBe(200);
    expect(nutritionUpdate.body.data.status).toBe("submitted");
    expect(nutritionSubmit.status).toBe(200);
    expect(nutritionSubmit.body.data.status).toBe("submitted");
    expect(nutritionSubmit.body.data.nutrition.submittedAt).toBeTruthy();
  });

  it("stores a named manual meal and allows exactly one content update", async () => {
    const data = await createActiveClient("manual-edit");
    const entryId = "b4444444-4444-4444-8444-444444444444";
    const created = await savePatch(
      data.client.accessToken,
      0,
      IDS.manualCreate,
      {
        nutrition: {
          entries: [
            {
              entryId,
              mode: "manual",
              mealName: "Bữa phụ",
              description: "Một quả chuối",
              status: "eaten",
            },
          ],
        },
      },
    );
    const updated = await savePatch(
      data.client.accessToken,
      1,
      IDS.manualEdit,
      {
        nutrition: {
          entries: [
            {
              entryId,
              mode: "manual",
              mealName: "Sau buổi tập",
              description: "Sữa chua và một quả chuối",
              status: "eaten",
            },
          ],
        },
      },
    );
    const denied = await savePatch(
      data.client.accessToken,
      2,
      IDS.manualEditAgain,
      {
        nutrition: {
          entries: [
            {
              entryId,
              mode: "manual",
              mealName: "Bữa tối muộn",
              description: "Hai quả chuối",
              status: "eaten",
            },
          ],
        },
      },
    );

    expect(created.body.data.nutrition.entries[0]).toMatchObject({
      mealName: "Bữa phụ",
      editCount: 0,
    });
    expect(updated.body.data.nutrition.entries[0]).toMatchObject({
      mealName: "Sau buổi tập",
      description: "Sữa chua và một quả chuối",
      editCount: 1,
    });
    expect(denied.status).toBe(409);
    expect(denied.body.code).toBe("MEAL_ENTRY_UPDATE_LIMIT_REACHED");
  });

  it("keeps legacy manual clients compatible with a clear meal-name fallback", async () => {
    const data = await createActiveClient("manual-legacy");
    const response = await savePatch(
      data.client.accessToken,
      0,
      IDS.manualCreate,
      {
        nutrition: {
          entries: [
            {
              entryId: "b5555555-5555-4555-8555-555555555555",
              mode: "manual",
              description: "Bữa ăn từ client cũ",
              status: "eaten",
            },
          ],
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.data.nutrition.entries[0]).toMatchObject({
      mealName: "Bữa ăn phát sinh",
      editCount: 0,
    });
  });

  it("rejects client attempts to set the server-owned edit counter", async () => {
    const data = await createActiveClient("manual-edit-count");
    const response = await savePatch(
      data.client.accessToken,
      0,
      IDS.manualTamper,
      {
        nutrition: {
          entries: [
            {
              entryId: "b6666666-6666-4666-8666-666666666666",
              mode: "manual",
              mealName: "Bữa phụ",
              description: "Một quả chuối",
              status: "eaten",
              editCount: 1,
            },
          ],
        },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_JOURNAL_NUTRITION");
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
      { wellness: { energy: 7 } },
    );
    const corrected = await withAuth(
      request(app)
        .post(`/api/daily-journals/${dateKey}/corrections`)
        .send({
          expectedRevision: 2,
          requestId: IDS.correction,
          reason: "Correct meal history",
          patch: { wellness: { energy: 7 } },
        }),
      data.client.accessToken,
    );

    expect(denied.status).toBe(409);
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.revision).toBe(3);
    expect(corrected.body.data.wellness.energy).toBe(7);
  });
});
