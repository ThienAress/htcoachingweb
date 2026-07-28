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
import TrainerSubscription from "../../models/TrainerSubscription.js";
import userRoutes from "../../routes/user.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/user", userRoutes);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("GET /api/user/trainer-assignment-candidates", () => {
  it("returns trainer-role and active subscriber users without duplicates", async () => {
    const admin = await createTestUser({ role: "admin", email: "admin@test.com" });
    const legacyTrainer = await createTestUser({
      role: "trainer",
      email: "legacy-trainer@test.com",
    });
    const subscriber = await createTestUser({ email: "subscriber@test.com" });
    const regularUser = await createTestUser({ email: "regular@test.com" });
    await TrainerSubscription.create({
      userId: subscriber.user._id,
      planTitle: "Tiêu chuẩn",
      planCode: "standard",
      billingCycle: "month",
      amount: 200000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "active",
      isActive: true,
      source: "admin_grant",
    });

    const response = await withAuth(
      request(app).get("/api/user/trainer-assignment-candidates?limit=100"),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.trainers.map((user) => user.email).sort()).toEqual(
      [legacyTrainer.user.email, subscriber.user.email].sort(),
    );
    expect(response.body.data.trainers).toHaveLength(2);
    expect(response.body.data.trainers).not.toContainEqual(
      expect.objectContaining({ email: regularUser.user.email }),
    );
  });

  it("rejects non-admin users", async () => {
    const actor = await createTestUser({ email: "normal@test.com" });
    const response = await withAuth(
      request(app).get("/api/user/trainer-assignment-candidates"),
      actor.accessToken,
    );
    expect(response.status).toBe(403);
  });
});
