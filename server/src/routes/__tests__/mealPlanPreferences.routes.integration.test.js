import {
  afterAll,
  afterEach,
  beforeAll,
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
import User from "../../models/User.js";
import userRoutes from "../user.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/user", userRoutes);
  await User.init();
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Meal Plan preferences owner-only", () => {
  it("returns an empty contract before the owner has declared preferences", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-empty@example.com",
    });

    const response = await withAuth(
      request(app).get("/api/user/me/meal-plan-preferences"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      allergyStatus: null,
      allergens: [],
      otherAllergenText: "",
      budgetVndPerDay: null,
      reviewedAt: null,
    });
  });

  it("stores a normalized other allergen while keeping the health field owner-only", async () => {
    const { user, accessToken } = await createTestUser({
      email: "meal-pref-other@example.com",
    });
    const response = await withAuth(
      request(app).put("/api/user/me/meal-plan-preferences").send({
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "  Ốc biển   và thịt bò  ",
        budgetVndPerDay: null,
      }),
      accessToken,
    );
    const genericUser = await User.findById(user._id).lean();

    expect({ status: response.status, data: response.body.data, genericUser }).toMatchObject({
      status: 200,
      data: {
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "Ốc biển và thịt bò",
        budgetVndPerDay: null,
      },
      genericUser: expect.not.objectContaining({ mealPlanPreferences: expect.anything() }),
    });
  });

  it("canonicalizes recognized foods separated only by spaces", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-tokenized@example.com",
    });
    const response = await withAuth(
      request(app).put("/api/user/me/meal-plan-preferences").send({
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "gà bò cá",
        budgetVndPerDay: null,
      }),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.otherAllergenText).toBe("Gà, Bò, Cá");
  });

  it("persists a validated declaration but excludes it from generic user DTOs", async () => {
    const { user, accessToken } = await createTestUser({
      email: "meal-pref-owner@example.com",
    });
    const payload = {
      allergyStatus: "declared",
      allergens: ["milk", "peanut"],
      budgetVndPerDay: 150_000,
    };

    const updated = await withAuth(
      request(app).put("/api/user/me/meal-plan-preferences").send(payload),
      accessToken,
    );
    const [readBack, genericMe, defaultSelection, explicitSelection] =
      await Promise.all([
        withAuth(
          request(app).get("/api/user/me/meal-plan-preferences"),
          accessToken,
        ),
        withAuth(request(app).get("/api/user/me"), accessToken),
        User.findById(user._id).lean(),
        User.findById(user._id).select("+mealPlanPreferences").lean(),
      ]);

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject(payload);
    expect(updated.body.data.reviewedAt).toBeTruthy();
    expect(readBack.body.data).toMatchObject(payload);
    expect(genericMe.body).not.toHaveProperty("mealPlanPreferences");
    expect(defaultSelection).not.toHaveProperty("mealPlanPreferences");
    expect(explicitSelection.mealPlanPreferences).toMatchObject(payload);
  });

  it("rejects inconsistent, free-text or out-of-range health input", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-invalid@example.com",
    });
    const responses = await Promise.all([
      withAuth(
        request(app)
          .put("/api/user/me/meal-plan-preferences")
          .send({
            allergyStatus: "none_known",
            allergens: ["milk"],
            budgetVndPerDay: null,
          }),
        accessToken,
      ),
      withAuth(
        request(app)
          .put("/api/user/me/meal-plan-preferences")
          .send({
            allergyStatus: "declared",
            allergens: ["private_symptom_text"],
            budgetVndPerDay: null,
          }),
        accessToken,
      ),
      withAuth(
        request(app)
          .put("/api/user/me/meal-plan-preferences")
          .send({
            allergyStatus: "unsure",
            allergens: [],
            budgetVndPerDay: 1_000,
          }),
        accessToken,
      ),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
  });

  it("rejects unsafe or inconsistent other-allergen text", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-other-invalid@example.com",
    });
    const responses = await Promise.all([
      withAuth(
        request(app).put("/api/user/me/meal-plan-preferences").send({
          allergyStatus: "none_known",
          allergens: [],
          otherAllergenText: "Ốc biển",
          budgetVndPerDay: null,
        }),
        accessToken,
      ),
      withAuth(
        request(app).put("/api/user/me/meal-plan-preferences").send({
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "https://example.com/private",
          budgetVndPerDay: null,
        }),
        accessToken,
      ),
      withAuth(
        request(app).put("/api/user/me/meal-plan-preferences").send({
          allergyStatus: "declared",
          allergens: [],
          otherAllergenText: "private@example.com",
          budgetVndPerDay: null,
        }),
        accessToken,
      ),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
  });

  it("rejects period separators and generic meat terms", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-ambiguous@example.com",
    });
    const responses = await Promise.all(
      ["bò.gà.heo", "thịt"].map((otherAllergenText) =>
        withAuth(
          request(app).put("/api/user/me/meal-plan-preferences").send({
            allergyStatus: "declared",
            allergens: [],
            otherAllergenText,
            budgetVndPerDay: null,
          }),
          accessToken,
        ),
      ),
    );

    expect(
      responses.map(({ status, body }) => ({ status, code: body.code })),
    ).toEqual([
      { status: 400, code: "MEAL_PLAN_OTHER_ALLERGEN_PERIOD_SEPARATOR" },
      { status: 400, code: "MEAL_PLAN_OTHER_ALLERGEN_TOO_GENERIC" },
    ]);
  });

  it("requires auth and CSRF for reads and writes", async () => {
    const { accessToken } = await createTestUser({
      email: "meal-pref-security@example.com",
    });
    const payload = {
      allergyStatus: "none_known",
      allergens: [],
      budgetVndPerDay: null,
    };

    const [anonymousRead, anonymousWrite, missingCsrf] = await Promise.all([
      request(app).get("/api/user/me/meal-plan-preferences"),
      request(app).put("/api/user/me/meal-plan-preferences").send(payload),
      request(app)
        .put("/api/user/me/meal-plan-preferences")
        .set("Cookie", [`accessToken=${accessToken}`, "csrfToken=expected"])
        .send(payload),
    ]);

    expect([anonymousRead.status, anonymousWrite.status, missingCsrf.status]).toEqual([
      401,
      401,
      403,
    ]);
  });
});
