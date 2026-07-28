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
import mealplanAccessRoutes from "../mealplanAccess.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/mealplan-access", mealplanAccessRoutes);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("meal plan generation quota", () => {
  it("allows only one concurrent trial claim", async () => {
    const actor = await createTestUser({
      email: "mealplan-race@example.com",
      mealPlanGenerations: 0,
    });

    const responses = await Promise.all([
      withAuth(
        request(app).post("/api/mealplan-access/record"),
        actor.accessToken,
      ),
      withAuth(
        request(app).post("/api/mealplan-access/record"),
        actor.accessToken,
      ),
    ]);
    const persisted = await User.findById(actor.user._id).lean();

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      403,
    ]);
    expect(persisted.mealPlanGenerations).toBe(1);
  });
});
