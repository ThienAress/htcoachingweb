import crypto from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import CoachingHabit from "../../models/CoachingHabit.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../../models/WeeklyCheckinRevision.js";
import WellnessTarget from "../../models/WellnessTarget.js";
import wellnessTargetRoutes from "../../routes/wellnessTarget.routes.js";
import { createCoachingHabit, updateCoachingHabit, changeCoachingHabitStatus } from "../coachingHabit.service.js";
import { reviewWeeklyCheckin } from "../weeklyCheckinReview.service.js";
import { setClientWellnessTarget } from "../wellnessTarget.service.js";
import { getMonthWeekPeriod, getVietnamDateKey } from "../../utils/dateKey.js";

const today = getVietnamDateKey();
const weekStartDateKey = getMonthWeekPeriod(today).startDateKey;
const targets = { sleepHours: 8, waterMl: 2500, steps: 8000 };
const actorOf = ({ user }) => ({ id: String(user._id), role: user.role });
let app;

const createAssigned = async () => {
  const trainer = await createTestUser({ role: "trainer" });
  const client = await createTestUser();
  const nextTrainer = await createTestUser({ role: "trainer" });
  const order = await Order.create({
    userId: client.user._id, trainerId: trainer.user._id,
    name: "Replay client", email: "replay@example.com", package: "PT",
    sessions: 5, totalSessions: 5, status: "approved",
  });
  return {
    actor: actorOf(trainer), clientId: String(client.user._id),
    transfer: () => Order.updateOne({ _id: order._id }, { $set: { trainerId: nextTrainer.user._id } }),
  };
};

const habitInput = () => ({
  requestId: crypto.randomUUID(), title: "Uống nước", category: "nutrition",
  schedule: { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startDateKey: today, endDateKey: null },
});

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/wellness-targets", wellnessTargetRoutes);
  await Promise.all([CoachingHabit.init(), WeeklyCheckin.init(), WeeklyCheckinRevision.init(), WellnessTarget.init()]);
});
beforeEach(() => {
  vi.stubEnv("TODAY_HABIT_WRITES_ENABLED", "true");
  vi.stubEnv("TODAY_WEEKLY_CHECKIN_WRITES_ENABLED", "true");
  vi.stubEnv("TODAY_WELLNESS_TARGET_WRITES_ENABLED", "true");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Effective coach authorization before command replay", () => {
  it.each(["weekly", "wellness", "habit-create", "habit-update", "habit-status"]
    .flatMap((action) => ["transaction", "duplicate-key"].map((boundary) => [action, boundary])))
  ("rechecks %s access at the %s replay boundary", async (action, boundary) => {
    const { actor, clientId, transfer } = await createAssigned();
    let replay;
    let replayModel;
    if (action === "weekly") {
      await WeeklyCheckin.create({ clientId, weekStartDateKey, status: "submitted", revision: 1 });
      const command = { actor, clientId, weekStartDateKey, expectedRevision: 1,
        requestId: crypto.randomUUID(), review: { message: "Kế hoạch tuần" } };
      replay = () => reviewWeeklyCheckin(command);
      replayModel = WeeklyCheckinRevision;
    } else if (action === "wellness") {
      const command = { actor, clientId, input: { expectedVersion: 0, requestId: crypto.randomUUID(), targets } };
      replay = () => setClientWellnessTarget(command);
      replayModel = WellnessTarget;
    } else {
      const input = habitInput();
      replay = () => createCoachingHabit({ actor, clientId, input });
      if (action !== "habit-create") {
        const first = await replay();
        const command = { actor, habitId: first.data._id, input: action === "habit-update"
          ? { ...habitInput(), expectedVersion: 1, title: "Điều chỉnh" }
          : { requestId: crypto.randomUUID(), expectedVersion: 1, status: "paused" } };
        replay = () => action === "habit-update"
          ? updateCoachingHabit(command) : changeCoachingHabitStatus(command);
      }
      replayModel = CoachingHabit;
    }
    await replay();

    // Simulate the fast lookup missing a concurrently committed command.
    const findOne = replayModel.findOne.bind(replayModel);
    let missedReplay = false;
    vi.spyOn(replayModel, "findOne").mockImplementation((filter, ...args) => {
      if (!missedReplay && (filter.requestId || filter.commandRequestId)) {
        missedReplay = true;
        return findOne({ _id: new mongoose.Types.ObjectId() }, ...args);
      }
      return findOne(filter, ...args);
    });
    const startSession = mongoose.startSession.bind(mongoose);
    vi.spyOn(mongoose, "startSession").mockImplementationOnce(async () => {
      const session = await startSession();
      await transfer();
      if (boundary === "duplicate-key") {
        vi.spyOn(session, "withTransaction").mockRejectedValueOnce(
          Object.assign(new Error("Synthetic duplicate command"), { code: 11000 }),
        );
      }
      return session;
    });
    await expect(replay()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies weekly-review replay after transfer while preserving valid retries", async () => {
    const { actor, clientId, transfer } = await createAssigned();
    await WeeklyCheckin.create({ clientId, weekStartDateKey, status: "submitted", revision: 1 });
    const command = { actor, clientId, weekStartDateKey, expectedRevision: 1,
      requestId: crypto.randomUUID(), review: { message: "Tiếp tục theo kế hoạch" } };
    await reviewWeeklyCheckin(command);
    expect((await reviewWeeklyCheckin(command)).idempotentReplay).toBe(true);
    await transfer();
    await expect(reviewWeeklyCheckin(command)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies an unrelated admin a personal weekly review", async () => {
    const { clientId } = await createAssigned();
    const admin = await createTestUser({ role: "admin" });
    await WeeklyCheckin.create({ clientId, weekStartDateKey, status: "submitted", revision: 1 });
    await expect(reviewWeeklyCheckin({ actor: actorOf(admin), clientId, weekStartDateKey,
      expectedRevision: 1, requestId: crypto.randomUUID(), review: { message: "Không thuộc HLV này" },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each(["create", "update", "status"])("denies habit %s replay after transfer", async (action) => {
    const { actor, clientId, transfer } = await createAssigned();
    const input = habitInput();
    const first = await createCoachingHabit({ actor, clientId, input });
    let replay = () => createCoachingHabit({ actor, clientId, input });
    if (action === "update") {
      const command = { actor, habitId: first.data._id,
        input: { ...habitInput(), expectedVersion: 1, title: "Uống nước đều" } };
      await updateCoachingHabit(command);
      replay = () => updateCoachingHabit(command);
    } else if (action === "status") {
      const command = { actor, habitId: first.data._id,
        input: { requestId: crypto.randomUUID(), expectedVersion: 1, status: "paused" } };
      await changeCoachingHabitStatus(command);
      replay = () => changeCoachingHabitStatus(command);
    }
    expect((await replay()).idempotentReplay).toBe(true);
    await transfer();
    await expect(replay()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies wellness-target replay after transfer while preserving valid retries", async () => {
    const { actor, clientId, transfer } = await createAssigned();
    const command = { actor, clientId, input: { expectedVersion: 0, requestId: crypto.randomUUID(), targets } };
    await setClientWellnessTarget(command);
    expect((await setClientWellnessTarget(command)).idempotentReplay).toBe(true);
    await transfer();
    await expect(setClientWellnessTarget(command)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("preserves verified trainer capability for an assigned role=user subscriber over HTTP", async () => {
    const trainer = await createTestUser({ role: "user" });
    const client = await createTestUser();
    await TrainerSubscription.create({ userId: trainer.user._id, planTitle: "Chuyên nghiệp",
      billingCycle: "month", amount: 0, startDate: new Date(),
      endDate: new Date(Date.now() + 86400000), status: "active", isActive: true });
    await Order.create({ userId: client.user._id, trainerId: trainer.user._id,
      name: "Subscribed client", email: "subscribed@example.com", package: "PT",
      sessions: 5, totalSessions: 5, status: "approved" });
    const response = await withAuth(request(app)
      .put(`/api/wellness-targets/trainer/clients/${client.user._id}`)
      .send({ expectedVersion: 0, requestId: crypto.randomUUID(), targets }), trainer.accessToken);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
  });
});
