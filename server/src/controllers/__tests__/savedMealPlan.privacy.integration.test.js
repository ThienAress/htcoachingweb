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
import {
  runReleaseCSavedMealPlanMigration,
  verifyReleaseCSavedMealPlanMigration,
} from "../../migrations/20260729-today-dashboard-release-c.js";
import Food from "../../models/Food.js";
import Order from "../../models/Order.js";
import SavedMealPlan from "../../models/SavedMealPlan.js";
import opsRoutes from "../../routes/ops.routes.js";
import savedMealPlanRoutes from "../../routes/savedMealPlan.routes.js";
import userRoutes from "../../routes/user.routes.js";
import {
  runSavedMealPlanRetentionSweep,
} from "../../services/savedMealPlanPrivacy.service.js";
import {
  syncDailyJournalRetentionForClient,
} from "../../services/dailyJournalRetentionPolicy.service.js";

let app;
const REQUEST_ID = "e1111111-1111-4111-8111-111111111111";

const createActive = async (suffix) => {
  const trainer = await createTestUser({
    email: "meal-privacy-trainer-" + suffix + "@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "meal-privacy-client-" + suffix + "@example.com",
  });
  await Order.create({
    userId: client.user._id,
    trainerId: trainer.user._id,
    name: client.user.name,
    email: client.user.email,
    package: "PT",
    sessions: 3,
    totalSessions: 3,
    status: "approved",
  });
  const food = await Food.create({
    label: "Food " + suffix,
    protein: 10,
    carb: 20,
    fat: 5,
    calories: 165,
  });
  return { client, trainer, food };
};

const createPlan = ({ client, food }, requestId = REQUEST_ID) =>
  withAuth(
    request(app)
      .post("/api/saved-meal-plans")
      .send({
        requestId,
        title: "Privacy plan",
        meals: [
          {
            key: "meal-1",
            name: "Bữa 1",
            type: "breakfast",
            foods: [{ foodId: food._id, amountGrams: 100 }],
          },
        ],
      }),
    client.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/saved-meal-plans", savedMealPlanRoutes);
  app.use("/api/ops", opsRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});

beforeEach(() => {
  process.env.TODAY_MEAL_PLAN_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_MEAL_PLAN_WRITES_ENABLED;
  delete process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Saved Meal Plan privacy lifecycle", () => {
  it("exports own snapshots and deletes all versions transactionally", async () => {
    const data = await createActive("delete");
    await createPlan(data);

    const exported = await withAuth(
      request(app).get("/api/saved-meal-plans/privacy/export"),
      data.client.accessToken,
    );
    const deleted = await withAuth(
      request(app)
        .delete("/api/saved-meal-plans/privacy")
        .send({ confirmation: "DELETE_MY_SAVED_MEAL_PLANS" }),
      data.client.accessToken,
    );

    expect(exported.status).toBe(200);
    expect(exported.body.data.items).toHaveLength(1);
    expect(JSON.stringify(exported.body.data)).not.toContain(
      "payloadFingerprint",
    );
    expect(JSON.stringify(exported.body.data)).not.toContain(
      "createdByRequestId",
    );
    expect(deleted.body.data).toEqual({ plans: 1 });
    expect(await SavedMealPlan.countDocuments()).toBe(0);
  });

  it("schedules retention on coaching end and clears it on renewal", async () => {
    const data = await createActive("policy");
    const response = await createPlan(data);
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );

    const scheduled = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
      coachingEndedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    const retained = await SavedMealPlan.findById(response.body.data._id);
    await Order.create({
      userId: data.client.user._id,
      trainerId: data.trainer.user._id,
      name: data.client.user.name,
      email: data.client.user.email,
      package: "Renewal",
      sessions: 3,
      totalSessions: 3,
      status: "approved",
    });
    const renewed = await syncDailyJournalRetentionForClient({
      clientId: data.client.user._id,
    });

    expect(scheduled.state).toBe("retention_scheduled");
    expect(retained.retentionExpiresAt).toBeInstanceOf(Date);
    expect(renewed.state).toBe("active");
    expect(
      (await SavedMealPlan.findById(response.body.data._id))
        .retentionExpiresAt,
    ).toBeNull();
  });

  it("never retains active-client candidates and requires the enforcement flag", async () => {
    const data = await createActive("retention");
    const admin = await createTestUser({
      email: "meal-privacy-admin@example.com",
      role: "admin",
    });
    const response = await createPlan(data);
    await SavedMealPlan.updateOne(
      { _id: response.body.data._id },
      { $set: { retentionExpiresAt: new Date(Date.now() - 60_000) } },
    );

    process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE = "true";
    const protectedResult = await runSavedMealPlanRetentionSweep({
      enforce: true,
      actorId: admin.user._id,
    });
    await Order.updateMany(
      { userId: data.client.user._id },
      { $set: { sessions: 0 } },
    );
    delete process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE;
    const disabled = await withAuth(
      request(app)
        .post("/api/ops/privacy/saved-meal-plans/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );
    process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE = "true";
    const enforced = await withAuth(
      request(app)
        .post("/api/ops/privacy/saved-meal-plans/retention")
        .send({ enforce: true }),
      admin.accessToken,
    );

    expect(protectedResult).toMatchObject({ candidates: 0, deleted: 0 });
    expect(disabled.status).toBe(503);
    expect(enforced.body.data.deleted).toBe(1);
    expect(await SavedMealPlan.countDocuments()).toBe(0);
  });

  it("creates indexes without backfill and includes plans in admin user deletion", async () => {
    const result = await runReleaseCSavedMealPlanMigration();
    const data = await createActive("admin-delete");
    const admin = await createTestUser({
      email: "meal-privacy-delete-admin@example.com",
      role: "admin",
    });
    await createPlan(data);

    const deleted = await withAuth(
      request(app).delete("/api/user/" + data.client.user._id),
      admin.accessToken,
    );

    expect(result.documentsModified).toBe(0);
    expect(result.verification.totalIssues).toBe(0);
    expect((await verifyReleaseCSavedMealPlanMigration()).totalIssues).toBe(0);
    expect(deleted.status).toBe(200);
    expect(await SavedMealPlan.countDocuments()).toBe(0);
  });
});
