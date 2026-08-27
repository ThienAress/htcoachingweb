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
import Exercise from "../../models/Exercise.js";
import exerciseRoutes from "../exercise.routes.js";
import {
  attachExerciseInstructionsJson as attachJson,
  buildExerciseInstructionsImportDocument as importDocument,
  buildExerciseInstructionsImportItem as importItem,
  exerciseTechnicalDifficultyRubric as rubric,
} from "./exerciseInstructionsImport.testHelpers.js";

const endpoint = "/api/exercises/instructions/import";

describe("Exercise instructions bulk import", () => {
  let app;
  let adminToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/exercises", exerciseRoutes);
    await Exercise.init();
  });

  beforeEach(async () => {
    adminToken = (await createTestUser({
      email: "exercise-import-admin@example.test",
      role: "admin",
    })).accessToken;
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("previews exact-name matches without writing exercise data", async () => {
    await Exercise.create({
      name: "Goblet Squat",
      muscleGroup: "Chân",
      description: "Mô tả gốc",
    });

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([importItem("Goblet Squat")]),
      true,
    );
    const stored = await Exercise.findOne({ name: "Goblet Squat" }).lean();

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      totalItems: 1,
      matchedItems: 1,
      missingItems: 0,
      canImport: true,
    });
    expect(stored.instructions).toEqual([]);
    expect(stored.technicalDifficulty).toBeUndefined();
  });

  test("commits instructions and rubric while preserving canonical fields", async () => {
    await Exercise.create({
      name: "Goblet Squat",
      muscleGroup: "Chân",
      description: "Mô tả gốc",
      imageUrl: "https://cdn.example.test/goblet.gif",
      videoUrl: "https://cdn.example.test/goblet.mp4",
    });

    const document = importDocument([importItem("Goblet Squat")]);
    const previewResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      false,
      previewResponse.body.data.previewToken,
    );
    const stored = await Exercise.findOne({ name: "Goblet Squat" }).lean();

    expect(response.status).toBe(200);
    expect(response.body.data.updatedItems).toBe(1);
    expect(stored.instructions.map((step) => step.title)).toEqual([
      "Vào vị trí",
      "Thực hiện",
    ]);
    expect(stored.technicalDifficulty.coordination).toBe(1);
    expect(stored).toMatchObject({
      muscleGroup: "Chân",
      description: "Mô tả gốc",
      imageUrl: "https://cdn.example.test/goblet.gif",
      videoUrl: "https://cdn.example.test/goblet.mp4",
    });
  });

  test("rolls back every update when one exact name is missing", async () => {
    await Exercise.create([
      { name: "Goblet Squat", muscleGroup: "Chân" },
      { name: "Push Up", muscleGroup: "Ngực" },
    ]);
    const document = importDocument([
      importItem("Goblet Squat"),
      importItem("Push Up"),
    ]);
    const previewResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      true,
    );
    await Exercise.deleteOne({ name: "Push Up" });

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      document,
      false,
      previewResponse.body.data.previewToken,
    );
    const stored = await Exercise.findOne({ name: "Goblet Squat" }).lean();

    expect(response.status).toBe(409);
    expect(response.body.details.missingNames).toEqual(["Push Up"]);
    expect(stored.instructions).toEqual([]);
  });

  test("rejects commit when the file was not previewed", async () => {
    await Exercise.create({ name: "Goblet Squat", muscleGroup: "Chân" });

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([importItem("Goblet Squat")]),
      false,
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("xem trước file");
  });

  test("rejects commit when the file differs from the previewed content", async () => {
    await Exercise.create({ name: "Goblet Squat", muscleGroup: "Chân" });
    const previewedDocument = importDocument([importItem("Goblet Squat")]);
    const changedDocument = importDocument([
      importItem("Goblet Squat", {
        instructions: [
          {
            title: "Nội dung đã đổi",
            description: "Không được ghi nếu chưa xem trước lại.",
          },
        ],
      }),
    ]);
    const previewResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      previewedDocument,
      true,
    );

    const response = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      changedDocument,
      false,
      previewResponse.body.data.previewToken,
    );
    const stored = await Exercise.findOne({ name: "Goblet Squat" }).lean();

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("File đã thay đổi");
    expect(stored.instructions).toEqual([]);
  });

  test("rejects duplicate names and unknown fields before lookup", async () => {
    const duplicateResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Goblet Squat"),
        importItem("Goblet Squat"),
      ]),
      true,
    );
    const unknownFieldResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Goblet Squat", { description: "Không được ghi đè" }),
      ]),
      true,
    );

    expect(duplicateResponse.status).toBe(400);
    expect(unknownFieldResponse.status).toBe(400);
  });

  test("requires all five rubric scores in the zero-to-two range", async () => {
    const incompleteResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Goblet Squat", {
          technicalDifficulty: {
            coordination: 1,
            stability: 1,
            mobility: 1,
            setup: 1,
          },
        }),
      ]),
      true,
    );
    const outOfRangeResponse = await attachJson(
      withAuth(request(app).post(endpoint), adminToken),
      importDocument([
        importItem("Goblet Squat", {
          technicalDifficulty: { ...rubric, errorConsequence: 3 },
        }),
      ]),
      true,
    );

    expect(incompleteResponse.status).toBe(400);
    expect(outOfRangeResponse.status).toBe(400);
  });

  test("requires an authenticated Admin before parsing the file", async () => {
    const userToken = (await createTestUser({
      email: "exercise-import-user@example.test",
      role: "user",
    })).accessToken;
    const document = importDocument([importItem("Goblet Squat")]);

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

    expect(unauthenticated.status).toBe(401);
    expect(userResponse.status).toBe(403);
  });

  test("requires a matching CSRF header before parsing the file", async () => {
    const response = await attachJson(
      request(app)
        .post(endpoint)
        .set("Cookie", [
          `accessToken=${adminToken}`,
          "csrfToken=test-csrf-token",
        ]),
      importDocument([importItem("Goblet Squat")]),
      true,
    );

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("CSRF token missing");
  });
});
