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
import { commitRecipeNutritionImport } from "../../services/recipeNutritionImport.service.js";
import {
  attachRecipeNutritionJson as attachJson,
  buildRecipeNutritionImportDocument as importDocument,
  buildRecipeNutritionImportItem as importItem,
  buildRecipeNutrition as nutrition,
} from "./recipeNutritionImport.testHelpers.js";

const endpoint = "/api/recipes/nutrition/import";
const ingredients = [
  { name: "Ức gà", measure: "200 g" },
  { name: "Gạo lứt", measure: "150 g đã nấu" },
];
const pinnedIngredients = [
  { name: "Cà rốt", measure: "100 g" },
  { name: "Đậu hũ", measure: "200 g" },
  { name: "Nấm", measure: "150 g" },
];
const substantiveStep = (label) =>
  `${label}: sơ chế từng nguyên liệu cẩn thận, thực hiện đúng thứ tự an toàn và kiểm tra độ chín trước khi chuyển sang bước tiếp theo để món ăn đạt chất lượng.`;

const createCanonicalRecipe = (overrides = {}) =>
  Recipe.create({
    name: "Cơm gà gạo lứt",
    slug: "com-ga-gao-lut",
    category: "Món chính",
    area: "Việt Nam",
    thumbnail: "https://cdn.example.test/com-ga.webp",
    ingredients,
    instructions: ["Áp chảo gà.", "Dùng cùng cơm."],
    source: "manual",
    isPublished: true,
    ...overrides,
  });

describe("Recipe nutrition bulk import", () => {
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
      email: "recipe-nutrition-import-admin@example.test",
      role: "admin",
    })).accessToken;
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("previews exact name and ingredient matches without writing", async () => {
    await createCanonicalRecipe();
    const document = importDocument([
      importItem("Cơm gà gạo lứt", ingredients),
    ]);

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    const stored = await Recipe.findOne({ slug: "com-ga-gao-lut" }).lean();

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      totalItems: 1,
      matchedItems: 1,
      issueItems: 0,
      canImport: true,
    });
    expect(response.body.data.previewToken).toEqual(expect.any(String));
    expect(stored.nutrition).toBeNull();
  });

  test("commits only nutrition and preserves canonical recipe fields", async () => {
    await createCanonicalRecipe();
    const document = importDocument([
      importItem("Cơm gà gạo lứt", ingredients),
    ]);
    const preview = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      false,
      preview.body.data.previewToken,
    );
    const stored = await Recipe.findOne({ slug: "com-ga-gao-lut" }).lean();

    expect(response.status).toBe(200);
    expect(response.body.data.updatedItems).toBe(1);
    expect(stored.nutrition).toMatchObject({
      scope: "whole_recipe",
      source: "admin_manual",
      calories: 520,
    });
    expect(stored.nutrition.additional).toContainEqual({
      label: "Chất xơ",
      unit: "g",
      value: 8.5,
    });
    expect(stored.nutrition.additional).toContainEqual({
      label: "Kali",
      unit: "g",
      value: 0.92,
    });
    expect(stored).toMatchObject({
      name: "Cơm gà gạo lứt",
      category: "Món chính",
      thumbnail: "https://cdn.example.test/com-ga.webp",
      ingredients,
      instructions: ["Áp chảo gà.", "Dùng cùng cơm."],
      source: "manual",
      isPublished: true,
    });
  });

  test("atomically rejects nutrition that makes a pinned Recipe ineligible", async () => {
    const pinned = await createCanonicalRecipe({
      name: "Vietnamese Style Veggie Hotpot",
      slug: "vietnamese-style-veggie-hotpot",
      ingredients: pinnedIngredients,
      instructions: [
        substantiveStep("Chuẩn bị"),
        substantiveStep("Chế biến"),
        substantiveStep("Hoàn thiện"),
      ],
      sourceUrl: "https://source.example.test/hotpot",
      nutrition: nutrition({ calories: 510 }),
    });
    const document = importDocument([
      importItem(pinned.name, pinnedIngredients, {
        nutrition: nutrition({ calories: 0 }),
      }),
    ]);
    const preview = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    let commitError;
    try {
      await commitRecipeNutritionImport(document);
    } catch (error) {
      commitError = error;
    }
    const stored = await Recipe.findById(pinned._id).lean();

    expect({
      previewStatus: preview.status,
      canImport: preview.body.data.summary.canImport,
      issueCode: preview.body.data.issues[0]?.code,
      previewToken: preview.body.data.previewToken,
      commitStatus: commitError?.status,
      commitCode: commitError?.details?.code,
      calories: stored.nutrition.calories,
    }).toEqual({
      previewStatus: 200,
      canImport: false,
      issueCode: "pinned_recipe_ineligible",
      previewToken: undefined,
      commitStatus: 409,
      commitCode: "PINNED_RECIPE_INELIGIBLE",
      calories: 510,
    });
  });

  test("blocks missing, ingredient-mismatched and ambiguous recipes", async () => {
    await createCanonicalRecipe();
    await createCanonicalRecipe({ slug: "com-ga-gao-lut-ban-sao" });
    const document = importDocument([
      importItem("Món không tồn tại", ingredients),
      importItem("Cơm gà gạo lứt", [
        ingredients[0],
        { name: "Gạo trắng", measure: "150 g" },
      ]),
      importItem("Cơm gà gạo lứt", ingredients),
    ]);

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      totalItems: 3,
      matchedItems: 0,
      issueItems: 3,
      canImport: false,
    });
    expect(response.body.data.issues.map((issue) => issue.code)).toEqual([
      "missing_name",
      "ingredients_mismatch",
      "ambiguous_match",
    ]);
    expect(response.body.data.previewToken).toBeUndefined();
  });

  test("rolls back all updates if ingredients change after preview", async () => {
    const first = await createCanonicalRecipe();
    await Recipe.create({
      name: "Canh rau củ",
      slug: "canh-rau-cu",
      ingredients: [{ name: "Cà rốt", measure: "100 g" }],
      isPublished: true,
    });
    const document = importDocument([
      importItem("Cơm gà gạo lứt", ingredients),
      importItem("Canh rau củ", [{ name: "Cà rốt", measure: "100 g" }]),
    ]);
    const preview = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    await Recipe.updateOne(
      { slug: "canh-rau-cu" },
      { $set: { ingredients: [{ name: "Cà rốt", measure: "120 g" }] } },
    );

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      false,
      preview.body.data.previewToken,
    );
    const storedFirst = await Recipe.findById(first._id).lean();

    expect(response.status).toBe(409);
    expect(response.body.details.issues[0].code).toBe(
      "ingredients_mismatch",
    );
    expect(storedFirst.nutrition).toBeNull();
  });

  test("requires preview and binds commit token to the exact file", async () => {
    await createCanonicalRecipe();
    const document = importDocument([
      importItem("Cơm gà gạo lứt", ingredients),
    ]);
    const preview = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    const changed = importDocument([
      importItem("Cơm gà gạo lứt", ingredients, {
        nutrition: nutrition({ calories: 600 }),
      }),
    ]);
    const withoutPreview = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      false,
    );
    const changedFile = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      changed,
      false,
      preview.body.data.previewToken,
    );

    expect(withoutPreview.status).toBe(400);
    expect(changedFile.status).toBe(409);
  });

});
