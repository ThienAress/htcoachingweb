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

const completeRubric = {
  coordination: 1,
  stability: 1,
  mobility: 1,
  setup: 1,
  errorConsequence: 1,
  rationale: "Bài đa khớp với yêu cầu kiểm soát vừa phải.",
};

const exercisePayload = {
  name: "Goblet Squat",
  muscleGroup: "Chân",
  description: "Squat với tạ đặt trước ngực",
};

describe("Exercise technical difficulty contract", () => {
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
      email: "exercise-admin@example.test",
      role: "admin",
    })).accessToken;
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("keeps legacy exercises valid and returns an unrated value", async () => {
    await Exercise.create(exercisePayload);

    const response = await request(app).get("/api/exercises");

    expect(response.body.data[0].technicalDifficultyRating).toBeNull();
  });

  test("derives three stars from a complete rubric scoring five", async () => {
    const response = await withAuth(
      request(app).post("/api/exercises").send({
        ...exercisePayload,
        technicalDifficulty: completeRubric,
      }),
      adminToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.technicalDifficultyRating).toBe(3);
  });

  test("keeps an incomplete rubric unrated", async () => {
    await Exercise.create({
      ...exercisePayload,
      technicalDifficulty: { coordination: 2, stability: 2 },
    });

    const response = await request(app).get("/api/exercises");

    expect(response.body.data[0].technicalDifficultyRating).toBeNull();
  });

  test("accepts an incomplete rubric through the admin API as unrated", async () => {
    const response = await withAuth(
      request(app).post("/api/exercises").send({
        ...exercisePayload,
        technicalDifficulty: { coordination: 1 },
      }),
      adminToken,
    );

    expect(response.body.data.technicalDifficultyRating).toBeNull();
  });

  test("rejects a criterion outside the zero-to-two integer range", async () => {
    const response = await withAuth(
      request(app).post("/api/exercises").send({
        ...exercisePayload,
        technicalDifficulty: { ...completeRubric, mobility: 3 },
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
  });

  test("rejects unknown rubric fields", async () => {
    const response = await withAuth(
      request(app).post("/api/exercises").send({
        ...exercisePayload,
        technicalDifficulty: { ...completeRubric, load: 2 },
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
  });

  test("rejects unknown rubric fields inside a batch item", async () => {
    const response = await withAuth(
      request(app).post("/api/exercises/batch").send({
        exercises: [
          {
            ...exercisePayload,
            technicalDifficulty: { ...completeRubric, load: 2 },
          },
        ],
      }),
      adminToken,
    );

    expect(response.status).toBe(400);
  });

  test("clears a reviewed rubric back to unrated", async () => {
    const exercise = await Exercise.create({
      ...exercisePayload,
      technicalDifficulty: completeRubric,
    });
    const response = await withAuth(
      request(app)
        .put(`/api/exercises/${exercise._id}`)
        .send({ technicalDifficulty: null }),
      adminToken,
    );

    expect(response.body.data.technicalDifficultyRating).toBeNull();
  });

  test("rejects an unsupported rating filter", async () => {
    const response = await request(app).get(
      "/api/exercises?technicalDifficultyRating=6",
    );

    expect(response.status).toBe(400);
  });

  test("filters the public list by derived rating", async () => {
    await Exercise.create([
      {
        ...exercisePayload,
        technicalDifficulty: completeRubric,
      },
      {
        ...exercisePayload,
        name: "Snatch",
        technicalDifficulty: {
          coordination: 2,
          stability: 2,
          mobility: 2,
          setup: 2,
          errorConsequence: 2,
        },
      },
      { ...exercisePayload, name: "Legacy Curl" },
    ]);

    const response = await request(app).get(
      "/api/exercises?technicalDifficultyRating=5",
    );

    expect(response.body.data.map((exercise) => exercise.name)).toEqual([
      "Snatch",
    ]);
  });

  test("combines the rating filter with existing search and muscle filters", async () => {
    await Exercise.create([
      {
        ...exercisePayload,
        technicalDifficulty: completeRubric,
      },
      {
        ...exercisePayload,
        name: "Goblet Squat Upper",
        muscleGroup: "Thân trên",
        technicalDifficulty: completeRubric,
      },
      {
        ...exercisePayload,
        name: "Snatch",
        technicalDifficulty: {
          coordination: 2,
          stability: 2,
          mobility: 2,
          setup: 2,
          errorConsequence: 2,
        },
      },
    ]);

    const response = await request(app).get(
      "/api/exercises?search=Goblet&muscleGroup=Ch%C3%A2n&technicalDifficultyRating=3",
    );

    expect(response.body.data.map((exercise) => exercise.name)).toEqual([
      "Goblet Squat",
    ]);
  });

  test("filters the public list to exercises without a complete rubric", async () => {
    await Exercise.create([
      { ...exercisePayload, technicalDifficulty: completeRubric },
      { ...exercisePayload, name: "Legacy Curl" },
      {
        ...exercisePayload,
        name: "Partial Row",
        technicalDifficulty: { coordination: 1 },
      },
    ]);

    const response = await request(app).get(
      "/api/exercises?technicalDifficultyRating=unrated",
    );

    expect(response.body.data.map((exercise) => exercise.name)).toEqual([
      "Legacy Curl",
      "Partial Row",
    ]);
  });
});
