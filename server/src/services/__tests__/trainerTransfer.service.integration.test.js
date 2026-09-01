import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import Checkin from "../../models/Checkin.js";
import CoachingDay from "../../models/CoachingDay.js";
import Contract from "../../models/Contract.js";
import F1Customer from "../../models/F1Customer.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import TrainerTransfer from "../../models/TrainerTransfer.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import TrainingSlotClaim from "../../models/TrainingSlotClaim.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import {
  buildTrainerTransferPreview,
  executeTrainerTransfer,
  listActiveTrainerAssignments,
  listRecentTrainerOrders,
} from "../trainerTransfer.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const createSubscription = (userId, overrides = {}) => {
  const now = Date.now();
  return TrainerSubscription.create({
    userId,
    planTitle: "Tiêu chuẩn",
    planCode: "standard",
    billingCycle: "month",
    amount: 200000,
    startDate: new Date(now - DAY_MS),
    endDate: new Date(now + 30 * DAY_MS),
    status: "active",
    ...overrides,
  });
};

const createOrder = (client, trainerId, overrides = {}) =>
  Order.create({
    userId: client._id,
    trainerId,
    name: client.name,
    email: client.email,
    package: "Gói 10 buổi",
    sessions: 8,
    totalSessions: 10,
    status: "approved",
    ...overrides,
  });

const createTransferFixture = async () => {
  const [{ user: admin }, { user: fromTrainer }, { user: toTrainer }, { user: client }] =
    await Promise.all([
      createTestUser({ email: "transfer-admin@example.com", role: "admin" }),
      createTestUser({ email: "transfer-from@example.com", role: "trainer" }),
      createTestUser({ email: "transfer-to@example.com", role: "trainer" }),
      createTestUser({ email: "transfer-client@example.com", name: "Khách chuyển HLV" }),
    ]);
  await Promise.all([
    createSubscription(fromTrainer._id),
    createSubscription(toTrainer._id),
  ]);
  const order = await createOrder(client, fromTrainer._id);
  const tomorrow = new Date(Date.now() + DAY_MS);
  const schedule = await TrainingSchedule.create({
    trainerId: fromTrainer._id,
    clientId: client._id,
    clientName: client.name,
    occurrenceDateKey: tomorrow.toISOString().slice(0, 10),
    startAt: tomorrow,
    endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    dayOfWeek: tomorrow.getUTCDay(),
    startTime: "08:00",
    endTime: "09:00",
    exerciseType: "Strength",
    status: "scheduled",
    expiresAt: new Date(tomorrow.getTime() + DAY_MS),
  });
  await Promise.all([
    TrainingSlotClaim.create({
      scheduleId: schedule._id,
      trainerId: fromTrainer._id,
      clientId: client._id,
      occurrenceDateKey: schedule.occurrenceDateKey,
      slotStartAt: schedule.startAt,
    }),
    WorkoutPlan.create({
      trainerId: fromTrainer._id,
      clientId: client._id,
      clientName: client.name,
      clientEmail: client.email,
      title: "Giáo án hiện tại",
      planDate: tomorrow,
      status: "published",
      sections: [],
    }),
    CoachingDay.create({
      userId: client._id,
      trainerId: fromTrainer._id,
      dateString: schedule.occurrenceDateKey,
      date: tomorrow,
      title: "Buổi tập hiện tại",
      exercises: [],
    }),
    Checkin.create({
      orderId: order._id,
      clientRequestId: "transfer-checkin",
      name: client.name,
      package: order.package,
      time: new Date(),
      muscle: "Ngực",
      remainingSessions: 8,
    }),
    Contract.create({
      orderId: order._id,
      clientId: client._id,
      trainerId: fromTrainer._id,
      clientInfo: { name: client.name, email: client.email },
      status: "signed",
    }),
    F1Customer.create({
      code: "F1-TRANSFER",
      fullName: client.name,
      age: 30,
      gender: "male",
      email: client.email,
      assignedTrainerId: fromTrainer._id,
      createdBy: fromTrainer._id,
    }),
  ]);
  return { admin, fromTrainer, toTrainer, client, order, schedule };
};

describe("trainer transfer service", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("lists only orders created during the last 30 days", async () => {
    const { fromTrainer, client } = await createTransferFixture();
    await createOrder(client, fromTrainer._id, {
      package: "Đơn cũ",
      createdAt: new Date(Date.now() - 40 * DAY_MS),
    });

    const result = await listRecentTrainerOrders({ page: 1, limit: 20 });

    expect(result.orders.map(({ package: name }) => name)).not.toContain("Đơn cũ");
  });

  it("lists active client-trainer assignments independently from order age", async () => {
    const { fromTrainer, client } = await createTransferFixture();
    await Order.updateMany(
      { userId: client._id, trainerId: fromTrainer._id },
      { $set: { createdAt: new Date(Date.now() - 40 * DAY_MS) } },
    );

    const result = await listActiveTrainerAssignments({ page: 1, limit: 20 });

    expect(result.assignments[0]).toMatchObject({
      client: { email: client.email },
      trainer: { email: fromTrainer.email },
      activeOrders: 1,
    });
  });

  it("previews affected and retained records without mutating assignment", async () => {
    const { fromTrainer, toTrainer, client, order } = await createTransferFixture();

    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });

    expect({
      orders: preview.affected.orders,
      schedules: preview.affected.schedules,
      checkins: preview.retained.checkins,
      contracts: preview.retained.contracts,
      signedContracts: preview.retained.signedContracts,
      f1Warning: preview.warnings.some(({ code }) => code === "F1_NOT_TRANSFERRED"),
      unchangedTrainer: String((await Order.findById(order._id)).trainerId),
    }).toEqual({
      orders: 1,
      schedules: 1,
      checkins: 1,
      contracts: 1,
      signedContracts: 1,
      f1Warning: true,
      unchangedTrainer: String(fromTrainer._id),
    });
  });

  it("moves current assignments atomically while retaining history and supports replay", async () => {
    const { admin, fromTrainer, toTrainer, client, order, schedule } =
      await createTransferFixture();
    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });
    const command = {
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
      actorId: admin._id,
      reason: "HLV hiện tại bàn giao khách hàng",
      requestId: "transfer-request-001",
      previewToken: preview.previewToken,
    };

    const first = await executeTrainerTransfer(command);
    const replay = await executeTrainerTransfer(command);
    const [updatedOrder, updatedSchedule, claim, workout, coaching, contract, f1] =
      await Promise.all([
        Order.findById(order._id).lean(),
        TrainingSchedule.findById(schedule._id).lean(),
        TrainingSlotClaim.findOne({ scheduleId: schedule._id }).lean(),
        WorkoutPlan.findOne({ clientId: client._id }).lean(),
        CoachingDay.findOne({ userId: client._id }).lean(),
        Contract.findOne({ clientId: client._id }).lean(),
        F1Customer.findOne({ email: client.email }).lean(),
      ]);

    expect({
      firstId: String(first.transfer._id),
      replayId: String(replay.transfer._id),
      orderTrainer: String(updatedOrder.trainerId),
      scheduleTrainer: String(updatedSchedule.trainerId),
      claimTrainer: String(claim.trainerId),
      workoutTrainer: String(workout.trainerId),
      coachingTrainer: String(coaching.trainerId),
      retainedContractTrainer: String(contract.trainerId),
      retainedF1Trainer: String(f1.assignedTrainerId),
      auditCount: await TrainerTransfer.countDocuments(),
    }).toEqual({
      firstId: String(first.transfer._id),
      replayId: String(first.transfer._id),
      orderTrainer: String(toTrainer._id),
      scheduleTrainer: String(toTrainer._id),
      claimTrainer: String(toTrainer._id),
      workoutTrainer: String(toTrainer._id),
      coachingTrainer: String(toTrainer._id),
      retainedContractTrainer: String(fromTrainer._id),
      retainedF1Trainer: String(fromTrainer._id),
      auditCount: 1,
    });

    await expect(
      executeTrainerTransfer({
        ...command,
        reason: "Một lý do chuyển khác không được replay",
      }),
    ).rejects.toMatchObject({
      code: "TRANSFER_REQUEST_ID_CONFLICT",
      status: 409,
    });
  });

  it("rejects a transfer when a schedule claim changes after preview", async () => {
    const { admin, fromTrainer, toTrainer, client, order, schedule } =
      await createTransferFixture();
    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });
    await TrainingSlotClaim.updateOne(
      { scheduleId: schedule._id },
      { $set: { slotStartAt: new Date(schedule.startAt.getTime() + 60_000) } },
    );

    await expect(
      executeTrainerTransfer({
        clientId: client._id,
        fromTrainerId: fromTrainer._id,
        toTrainerId: toTrainer._id,
        actorId: admin._id,
        reason: "Lịch đã thay đổi sau bước xem trước",
        requestId: "transfer-stale-claim-001",
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ code: "TRAINER_TRANSFER_STALE" });
    expect(String((await Order.findById(order._id)).trainerId)).toBe(
      String(fromTrainer._id),
    );
  });

  it("rejects overlapping target schedules even when start times differ", async () => {
    const { admin, fromTrainer, toTrainer, client, order, schedule } =
      await createTransferFixture();
    const overlapStart = new Date(schedule.startAt.getTime() + 30 * 60 * 1000);
    const overlapEnd = new Date(schedule.endAt.getTime() + 30 * 60 * 1000);
    const targetSchedule = await TrainingSchedule.create({
      trainerId: toTrainer._id,
      clientId: (await createTestUser({
        email: "transfer-overlap-client@example.com",
      })).user._id,
      clientName: "Khách trùng lịch",
      occurrenceDateKey: schedule.occurrenceDateKey,
      startAt: overlapStart,
      endAt: overlapEnd,
      dayOfWeek: overlapStart.getUTCDay(),
      startTime: "08:30",
      endTime: "09:30",
      exerciseType: "Mobility",
      status: "scheduled",
      expiresAt: new Date(overlapEnd.getTime() + DAY_MS),
    });
    await TrainingSlotClaim.create({
      scheduleId: targetSchedule._id,
      trainerId: toTrainer._id,
      clientId: targetSchedule.clientId,
      occurrenceDateKey: targetSchedule.occurrenceDateKey,
      slotStartAt: overlapStart,
    });

    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });

    expect(preview.canTransfer).toBe(false);
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TARGET_SCHEDULE_CONFLICT" }),
      ]),
    );
    await expect(
      executeTrainerTransfer({
        clientId: client._id,
        fromTrainerId: fromTrainer._id,
        toTrainerId: toTrainer._id,
        actorId: admin._id,
        reason: "Lịch HLV nhận đang chồng lấn một phần",
        requestId: "transfer-overlap-001",
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ code: "TARGET_SCHEDULE_CONFLICT" });
    expect(String((await Order.findById(order._id)).trainerId)).toBe(
      String(fromTrainer._id),
    );
  });

  it("rejects a transfer when the target trainer has reached plan capacity", async () => {
    const { admin, fromTrainer, toTrainer, client } = await createTransferFixture();
    for (let index = 0; index < 5; index += 1) {
      const { user } = await createTestUser({
        email: `capacity-${index}@example.com`,
      });
      await createOrder(user, toTrainer._id);
    }
    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });

    await expect(
      executeTrainerTransfer({
        clientId: client._id,
        fromTrainerId: fromTrainer._id,
        toTrainerId: toTrainer._id,
        actorId: admin._id,
        reason: "Kiểm tra giới hạn gói",
        requestId: "transfer-capacity-001",
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ code: "TRAINER_CAPACITY_EXCEEDED", status: 409 });
  });

  it("counts pending clients toward the target trainer capacity", async () => {
    const { admin, fromTrainer, toTrainer, client } =
      await createTransferFixture();
    for (let index = 0; index < 5; index += 1) {
      const { user } = await createTestUser({
        email: `pending-capacity-${index}@example.com`,
      });
      await createOrder(user, toTrainer._id, { status: "pending" });
    }
    const preview = await buildTrainerTransferPreview({
      clientId: client._id,
      fromTrainerId: fromTrainer._id,
      toTrainerId: toTrainer._id,
    });

    expect(preview.capacity).toMatchObject({
      currentClients: 5,
      projectedClients: 6,
      maxClients: 5,
      exceeded: true,
    });
    await expect(
      executeTrainerTransfer({
        clientId: client._id,
        fromTrainerId: fromTrainer._id,
        toTrainerId: toTrainer._id,
        actorId: admin._id,
        reason: "Pending cũng phải chiếm sức chứa",
        requestId: "transfer-pending-capacity-001",
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({
      code: "TRAINER_CAPACITY_EXCEEDED",
      status: 409,
    });
  });
});
