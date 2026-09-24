import crypto from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearCollections, createTestUser, setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import Order from "../../models/Order.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../../models/TrainingSlotClaim.js";
import { createTrainingOccurrence, rescheduleTrainingOccurrence } from "../trainingScheduleCommand.service.js";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/dateKey.js";

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([TrainingSchedule.init(), TrainingScheduleCommand.init(), TrainingSlotClaim.init()]);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Current schedule authorization on command replay", () => {
  it.each(["create", "reschedule"].flatMap((action) =>
    ["fast", "transaction", "duplicate-key", "assignment-only"].map((boundary) => [action, boundary])))
  ("denies %s replay at %s boundary after transfer", async (action, boundary) => {
    const trainer = await createTestUser({ role: "trainer" });
    const replacement = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    const actor = { id: String(trainer.user._id), role: "trainer" };
    const order = await Order.create({ userId: client.user._id, trainerId: trainer.user._id,
      name: "Replay client", email: "schedule-replay@example.com", package: "PT",
      sessions: 5, totalSessions: 5, status: "approved" });
    const command = { actor, source: "trainer", input: {
      clientId: String(client.user._id), requestId: crypto.randomUUID(),
      occurrenceDateKey: addDaysToDateKey(getVietnamDateKey(), 1),
      startTime: "09:00", endTime: "10:00", exerciseType: "Gym",
    } };
    const created = await createTrainingOccurrence(command);
    let replay = () => createTrainingOccurrence(command);
    if (action === "reschedule") {
      const update = { actor, source: "trainer", scheduleId: String(created.schedule._id),
        input: { requestId: crypto.randomUUID(), revision: 0, startTime: "10:00", endTime: "11:00" } };
      await rescheduleTrainingOccurrence(update);
      replay = () => rescheduleTrainingOccurrence(update);
    }
    expect((await replay()).idempotentReplay).toBe(true);
    const transfer = async () => {
      await Order.updateOne({ _id: order._id }, { $set: { trainerId: replacement.user._id } });
      if (boundary !== "assignment-only") {
        await TrainingSchedule.updateOne({ _id: created.schedule._id },
          { $set: { trainerId: replacement.user._id, notes: "New coach private update" } });
      }
    };
    if (["fast", "assignment-only"].includes(boundary)) {
      await transfer();
    } else {
      const findOne = TrainingScheduleCommand.findOne.bind(TrainingScheduleCommand);
      vi.spyOn(TrainingScheduleCommand, "findOne").mockImplementationOnce(() =>
        findOne({ _id: new mongoose.Types.ObjectId() }));
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
    }
    await expect(replay()).rejects.toMatchObject({ statusCode: 403 });
  });
});
