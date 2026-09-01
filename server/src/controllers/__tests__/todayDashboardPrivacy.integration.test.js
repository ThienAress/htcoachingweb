import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
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
import DailyJournal from "../../models/DailyJournal.js";
import FitnessPlusQuotaUsage from "../../models/FitnessPlusQuotaUsage.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import MorningHealthReminderDelivery from "../../models/MorningHealthReminderDelivery.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import userRoutes from "../../routes/user.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Today Dashboard user deletion orchestration", () => {
  it("deletes the morning health reminder delivery ledger with the account", async () => {
    const admin = await createTestUser({
      email: "reminder-delete-admin@example.com",
      role: "admin",
    });
    const client = await createTestUser({
      email: "reminder-delete-client@example.com",
    });
    await MorningHealthReminderDelivery.create({
      _id: "a".repeat(64),
      recipientId: client.user._id,
      dateKey: "2026-08-29",
      status: "sent",
      attempts: 1,
      sentAt: new Date(),
    });

    const response = await withAuth(
      request(app).delete(`/api/user/${client.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(
      await MorningHealthReminderDelivery.countDocuments({
        recipientId: client.user._id,
      }),
    ).toBe(0);
  });

  it("retains purchased HT Fitness+ history but deletes quota state", async () => {
    const admin = await createTestUser({
      email: "fitness-delete-admin@example.com",
      role: "admin",
    });
    const client = await createTestUser({
      email: "fitness-delete-client@example.com",
    });
    await FitnessSubscription.create({
      userId: client.user._id,
      planCode: "fitness_plus_smart",
      planTitle: "Tăng tốc",
      billingCycle: "month",
      amount: 199_000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    });
    await FitnessPlusQuotaUsage.create({
      userId: client.user._id,
      serviceKey: "ai_chat",
      timestamps: [new Date()],
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const response = await withAuth(
      request(app).delete(`/api/user/${client.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(await User.exists({ _id: client.user._id })).toBeNull();
    expect(
      await FitnessSubscription.countDocuments({ userId: client.user._id }),
    ).toBe(1);
    expect(
      await FitnessPlusQuotaUsage.countDocuments({ userId: client.user._id }),
    ).toBe(0);
  });

  it("rolls back every collection when the final user deletion fails", async () => {
    const admin = await createTestUser({
      email: "dashboard-delete-admin@example.com",
      role: "admin",
    });
    const trainer = await createTestUser({
      email: "dashboard-delete-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "dashboard-delete-client@example.com",
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
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2026-07-29",
      revision: 1,
    });
    vi.spyOn(User, "deleteMany").mockImplementationOnce(() => {
      throw new Error("injected deletion failure");
    });

    const response = await withAuth(
      request(app).delete("/api/user/" + client.user._id),
      admin.accessToken,
    );

    expect(response.status).toBe(500);
    expect(await User.exists({ _id: client.user._id })).toBeTruthy();
    expect(await Order.countDocuments({ userId: client.user._id })).toBe(1);
    expect(
      await DailyJournal.countDocuments({ clientId: client.user._id }),
    ).toBe(1);
  });
});
