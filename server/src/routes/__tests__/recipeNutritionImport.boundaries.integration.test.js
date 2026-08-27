import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Recipe from "../../models/Recipe.js";
import recipeRoutes from "../recipe.routes.js";
import {
  attachRecipeNutritionJson as attachJson,
  buildRecipeNutritionImportDocument as importDocument,
  buildRecipeNutritionImportItem as importItem,
  buildRecipeNutrition as nutrition,
} from "./recipeNutritionImport.testHelpers.js";

const endpoint = "/api/recipes/nutrition/import";
const ingredients = [{ name: "Ức gà", measure: "200 g" }];

describe("Recipe nutrition import boundaries", () => {
  let app;
  let adminToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/recipes", recipeRoutes);
    await Recipe.init();
  });

  beforeEach(async () => {
    adminToken = (await createTestUser({
      email: "recipe-nutrition-boundary-admin@example.test",
      role: "admin",
    })).accessToken;
  });

  afterEach(async () => clearCollections());
  afterAll(async () => teardownTestDB());

  test("rejects unknown fields, duplicate identities and 61 nutrients", async () => {
    const extraNutrients = Array.from({ length: 61 }, (_, index) => ({
      label: `Vi chất ${index + 1}`,
      unit: "mg",
      value: index,
    }));
    const unknownField = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Cơm gà", ingredients, {
          instructions: ["Không được ghi đè"],
        }),
      ]),
      true,
    );
    const duplicate = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Cơm gà", ingredients),
        importItem("Cơm gà", ingredients),
      ]),
      true,
    );
    const tooManyNutrients = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Cơm gà", ingredients, {
          nutrition: nutrition({ additional: extraNutrients }),
        }),
      ]),
      true,
    );
    const nonStringLabel = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Cơm gà", ingredients, {
          nutrition: nutrition({
            additional: [{ label: 123, unit: "mg", value: 1 }],
          }),
        }),
      ]),
      true,
    );

    expect(unknownField.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(tooManyNutrients.status).toBe(400);
    expect(nonStringLabel.status).toBe(400);
  });

  test("accepts all 60 additional nutrients", async () => {
    await Recipe.create({
      name: "Cơm gà",
      slug: "com-ga",
      ingredients,
      isPublished: true,
    });
    const extraNutrients = Array.from({ length: 60 }, (_, index) => ({
      label: `Vi chất ${index + 1}`,
      unit: "mcg",
      value: index / 10,
    }));
    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Cơm gà", ingredients, {
          nutrition: nutrition({ additional: extraNutrients }),
        }),
      ]),
      true,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.previewItems[0].additionalCount).toBe(60);
  });

  test("requires authenticated Admin and a matching CSRF header", async () => {
    const userToken = (await createTestUser({
      email: "recipe-nutrition-boundary-user@example.test",
      role: "user",
    })).accessToken;
    const document = importDocument([importItem("Cơm gà", ingredients)]);
    const unauthenticated = await attachJson(
      request(app).post(endpoint),
      document,
      true,
    );
    const userResponse = await attachJson(
      withAuth(request(app).post(endpoint), userToken),
      document,
      true,
    );
    const csrfResponse = await attachJson(
      request(app)
        .post(endpoint)
        .set("Cookie", [
          `accessToken=${adminToken}`,
          "csrfToken=test-csrf-token",
        ]),
      document,
      true,
    );

    expect(unauthenticated.status).toBe(401);
    expect(userResponse.status).toBe(403);
    expect(csrfResponse.status).toBe(403);
    expect(csrfResponse.body.message).toBe("CSRF token missing");
  });
});
