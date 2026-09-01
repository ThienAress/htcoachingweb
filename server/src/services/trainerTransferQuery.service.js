import crypto from "crypto";
import mongoose from "mongoose";

import Checkin from "../models/Checkin.js";
import CoachingDay from "../models/CoachingDay.js";
import Contract from "../models/Contract.js";
import F1Customer from "../models/F1Customer.js";
import Order from "../models/Order.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainerTransferLock from "../models/TrainerTransferLock.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import User from "../models/User.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { getMaxClientsByPlan } from "./trainerPlanCatalog.service.js";
import { transferError } from "./trainerTransferErrors.js";

const ACTIVE_ORDER_FILTER = {
  $or: [
    { status: "pending" },
    { status: "approved", sessions: { $gt: 0 } },
  ],
};

const asObjectId = (value, field) => {
  if (!mongoose.isValidObjectId(value)) {
    throw transferError(400, "INVALID_TRAINER_TRANSFER_INPUT", `${field} không hợp lệ`);
  }
  return new mongoose.Types.ObjectId(value);
};

const withSession = (query, session) => (session ? query.session(session) : query);
const resolveQueries = async (queries, session) => {
  if (!session) return Promise.all(queries);
  const results = [];
  for (const query of queries) results.push(await query);
  return results;
};
const documentVersion = (document) => [
  String(document._id),
  document.updatedAt?.toISOString?.() || "",
  Number(document.__v) || 0,
];

const createPreviewToken = (snapshot) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify({
      clientId: String(snapshot.client._id),
      fromTrainerId: String(snapshot.fromTrainer._id),
      toTrainerId: String(snapshot.toTrainer._id),
      lockRevision: snapshot.lockRevision,
      maxClients: snapshot.maxClients,
      slotConflictCount: snapshot.slotConflictCount,
      targetClientIds: snapshot.targetClientIds.map(String).sort(),
      orders: snapshot.orders.map(documentVersion),
      schedules: snapshot.schedules.map(documentVersion),
      claims: snapshot.claims.map(documentVersion),
      workoutPlans: snapshot.workoutPlans.map(documentVersion),
      coachingDays: snapshot.coachingDays.map(documentVersion),
    }))
    .digest("hex");

const serializeActor = (actor) => ({
  _id: actor._id,
  name: actor.name,
  email: actor.email,
});

export const loadTrainerTransferSnapshot = async ({
  clientId,
  fromTrainerId,
  toTrainerId,
  now = new Date(),
  session = null,
}) => {
  const ids = {
    clientId: asObjectId(clientId, "clientId"),
    fromTrainerId: asObjectId(fromTrainerId, "fromTrainerId"),
    toTrainerId: asObjectId(toTrainerId, "toTrainerId"),
  };
  if (ids.fromTrainerId.equals(ids.toTrainerId)) {
    throw transferError(400, "SAME_TRAINER_TRANSFER", "HLV mới phải khác HLV hiện tại");
  }

  const [client, fromTrainer, toTrainer, targetSubscription, lock] =
    await resolveQueries([
    withSession(User.findById(ids.clientId).select("name email"), session).lean(),
    withSession(User.findById(ids.fromTrainerId).select("name email role"), session).lean(),
    withSession(User.findById(ids.toTrainerId).select("name email role"), session).lean(),
    withSession(
      TrainerSubscription.findOne({
        userId: ids.toTrainerId,
        isActive: true,
        status: "active",
        endDate: { $gt: now },
      }).select("planCode planTitle"),
      session,
    ).lean(),
      withSession(TrainerTransferLock.findById(ids.toTrainerId), session).lean(),
    ], session);
  if (!client || !fromTrainer) {
    throw transferError(404, "TRANSFER_ACTOR_NOT_FOUND", "Không tìm thấy khách hoặc HLV hiện tại");
  }
  if (!toTrainer || (toTrainer.role !== "trainer" && !targetSubscription)) {
    throw transferError(409, "TARGET_TRAINER_INACTIVE", "HLV mới không có quyền hoạt động");
  }
  const maxClients = getMaxClientsByPlan(
    targetSubscription?.planCode || targetSubscription?.planTitle || "free",
  );
  if (maxClients < 1) {
    throw transferError(409, "TARGET_TRAINER_PLAN_INVALID", "Không xác định được giới hạn gói HLV mới");
  }

  const orderFilter = {
    userId: ids.clientId,
    trainerId: ids.fromTrainerId,
    ...ACTIVE_ORDER_FILTER,
  };
  const scheduleFilter = {
    clientId: ids.clientId,
    trainerId: ids.fromTrainerId,
    status: "scheduled",
    $or: [
      { startAt: { $gte: now } },
      { startAt: null, expiresAt: { $gte: now } },
    ],
  };
  const workoutFilter = {
    clientId: ids.clientId,
    trainerId: ids.fromTrainerId,
    status: { $in: ["draft", "published"] },
  };
  const coachingFilter = {
    userId: ids.clientId,
    trainerId: ids.fromTrainerId,
    $or: [{ clientStatus: "pending" }, { date: { $gte: now } }],
  };
  const [orders, schedules, workoutPlans, coachingDays, targetClientIds] =
    await resolveQueries([
      withSession(Order.find(orderFilter).select("status updatedAt __v"), session).lean(),
      withSession(
        TrainingSchedule.find(scheduleFilter).select(
          "startAt endAt updatedAt __v",
        ),
        session,
      ).lean(),
      withSession(WorkoutPlan.find(workoutFilter).select("status planDate updatedAt __v"), session).lean(),
      withSession(CoachingDay.find(coachingFilter).select("clientStatus date updatedAt __v"), session).lean(),
      withSession(
        Order.distinct("userId", {
          trainerId: ids.toTrainerId,
          userId: { $ne: null },
          status: { $in: ["pending", "approved"] },
          sessions: { $gt: 0 },
        }),
        session,
      ),
    ], session);
  if (orders.length === 0) {
    throw transferError(404, "TRANSFER_SOURCE_ASSIGNMENT_NOT_FOUND", "Không có Order đang hoạt động để chuyển");
  }

  const orderIds = orders.map(({ _id }) => _id);
  const scheduleIds = schedules.map(({ _id }) => _id);
  const claims = scheduleIds.length
    ? await withSession(
        TrainingSlotClaim.find({ scheduleId: { $in: scheduleIds } }).select(
          "slotStartAt updatedAt __v",
        ),
        session,
      ).lean()
    : [];
  const claimConflictCount = claims.length
    ? await withSession(
        TrainingSlotClaim.countDocuments({
          trainerId: ids.toTrainerId,
          slotStartAt: { $in: claims.map(({ slotStartAt }) => slotStartAt) },
        }),
        session,
      )
    : 0;
  const overlapFilters = schedules
    .filter(({ startAt, endAt }) => startAt && endAt)
    .map(({ startAt, endAt }) => ({
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    }));
  const scheduleConflictCount = overlapFilters.length
    ? await withSession(
        TrainingSchedule.countDocuments({
          trainerId: ids.toTrainerId,
          status: "scheduled",
          $or: overlapFilters,
        }),
        session,
      )
    : 0;
  const slotConflictCount = Math.max(
    claimConflictCount,
    scheduleConflictCount,
  );
  const [checkins, contracts, signedContracts, f1Customers] =
    await resolveQueries([
    withSession(Checkin.countDocuments({ orderId: { $in: orderIds } }), session),
    withSession(Contract.countDocuments({ orderId: { $in: orderIds } }), session),
    withSession(
      Contract.countDocuments({
        orderId: { $in: orderIds },
        status: "signed",
      }),
      session,
    ),
    withSession(
      F1Customer.countDocuments({
        assignedTrainerId: ids.fromTrainerId,
        email: String(client.email || "").toLowerCase(),
        status: { $ne: "archived" },
      }),
      session,
      ),
    ], session);

  const alreadyManaged = targetClientIds.some((id) => ids.clientId.equals(id));
  const projectedClients = targetClientIds.length + (alreadyManaged ? 0 : 1);
  const snapshot = {
    ids,
    client,
    fromTrainer,
    toTrainer,
    lockRevision: lock?.revision || 0,
    maxClients,
    projectedClients,
    targetClientIds,
    orders,
    schedules,
    claims,
    workoutPlans,
    coachingDays,
    slotConflictCount,
    retained: { checkins, contracts, signedContracts, f1Customers },
  };
  snapshot.previewToken = createPreviewToken(snapshot);
  return snapshot;
};

export const serializeTrainerTransferPreview = (snapshot) => {
  const capacityExceeded = snapshot.projectedClients > snapshot.maxClients;
  const warnings = [];
  if (snapshot.retained.contracts > 0) {
    warnings.push({ code: "CONTRACTS_RETAINED", message: "Hợp đồng giữ nguyên HLV lịch sử; tạo hợp đồng mới nếu cần" });
  }
  if (snapshot.retained.f1Customers > 0) {
    warnings.push({ code: "F1_NOT_TRANSFERRED", message: "Hồ sơ F1 CRM không tự động chuyển trong lần này" });
  }
  if (snapshot.slotConflictCount > 0) {
    warnings.push({ code: "TARGET_SCHEDULE_CONFLICT", message: "HLV mới đang có lịch trùng giờ" });
  }
  return {
    previewToken: snapshot.previewToken,
    canTransfer: !capacityExceeded && snapshot.slotConflictCount === 0,
    client: serializeActor(snapshot.client),
    fromTrainer: serializeActor(snapshot.fromTrainer),
    toTrainer: serializeActor(snapshot.toTrainer),
    affected: {
      orders: snapshot.orders.length,
      schedules: snapshot.schedules.length,
      scheduleClaims: snapshot.claims.length,
      workoutPlans: snapshot.workoutPlans.length,
      coachingDays: snapshot.coachingDays.length,
    },
    retained: snapshot.retained,
    capacity: {
      currentClients: snapshot.targetClientIds.length,
      projectedClients: snapshot.projectedClients,
      maxClients: snapshot.maxClients,
      exceeded: capacityExceeded,
    },
    warnings,
  };
};

export const buildTrainerTransferPreview = async (input) =>
  serializeTrainerTransferPreview(await loadTrainerTransferSnapshot(input));
