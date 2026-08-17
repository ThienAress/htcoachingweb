import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import ExerciseSuggestion from "../../models/ExerciseSuggestion.js";
import exerciseSuggestionRoutes from "../exerciseSuggestion.routes.js";

const TEST_CSRF = "test-exercise-suggestion-csrf";

const anonymousSuggestion = (app, body) =>
  request(app)
    .post("/api/exercise-suggestions")
    .set("Cookie", [`csrfToken=${TEST_CSRF}`])
    .set("X-CSRF-Token", TEST_CSRF)
    .send(body);

describe("exercise suggestion route contracts", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/exercise-suggestions", exerciseSuggestionRoutes);
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("rejects a public mutation without CSRF before writing", async () => {
    const response = await request(app)
      .post("/api/exercise-suggestions")
      .send({ name: "Incline row" });

    expect(response.status).toBe(403);
    expect(await ExerciseSuggestion.countDocuments()).toBe(0);
  });

  test("rejects unknown or unbounded public fields", async () => {
    const response = await anonymousSuggestion(app, {
      name: "Incline row",
      description: "x".repeat(1001),
      status: "approved",
    });

    expect(response.status).toBe(400);
    expect(await ExerciseSuggestion.countDocuments()).toBe(0);
  });

  test("normalizes and stores an anonymous suggestion through the bounded contract", async () => {
    const response = await anonymousSuggestion(app, {
      name: "  Incline row  ",
      muscleGroup: "  Back  ",
      description: "  Add a chest-supported variation.  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Incline row",
      muscleGroup: "Back",
      description: "Add a chest-supported variation.",
      status: "pending",
    });
  });

  test("bounds admin pagination before executing the list query", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });

    const response = await withAuth(
      request(app).get("/api/exercise-suggestions?limit=100000&search=(a+)+$"),
      accessToken,
    );

    expect(response.status).toBe(400);
  });

  test("rejects an invalid admin status update before mutation", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const suggestion = await ExerciseSuggestion.create({ name: "Incline row" });

    const response = await withAuth(
      request(app).patch(`/api/exercise-suggestions/${suggestion._id}/status`),
      accessToken,
    ).send({ status: "published", adminNote: "x".repeat(1001) });

    expect(response.status).toBe(400);
    expect((await ExerciseSuggestion.findById(suggestion._id)).status).toBe(
      "pending",
    );
  });

  test("rejects an invalid admin delete identifier before reaching MongoDB", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });

    const response = await withAuth(
      request(app).delete("/api/exercise-suggestions/not-an-object-id"),
      accessToken,
    );

    expect(response.status).toBe(400);
  });
});
