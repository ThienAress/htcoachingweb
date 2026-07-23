import crypto from "node:crypto";
import mongoose from "mongoose";

import AuditLog from "../models/AuditLog.js";
import Order from "../models/Order.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  buildSlotStarts,
  normalizeOccurrenceInput,
} from "./trainingOccurrence.service.js";

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_EDIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const commandError = (statusCode, message, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = code;
  return error;
};

const assertRequestId = (requestId) => {
  if (!REQUEST_ID_PATTERN.test(String(requestId || ""))) {
    throw commandError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
};

const assertRevision = (revision) => {
  if (!Number.isInteger(revision) || revision < 0) {
    throw commandError(400, "revision không hợp lệ", "INVALID_REVISION");
  }
};

const fingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");

const actorAuditRole = (actor, source) => {
  if (actor.role === "admin") return "admin";
  if (source === "trainer") return "trainer";
  return "user";
};

const getRequestContext = (requestContext = {}) => ({
  ipAddress: requestContext.ipAddress,
  userAgent: requestContext.userAgent,
});

const findReplay = async ({
  actorId,
  requestId,
  commandType,
  payloadFingerprint,
  session,
}) => {
  let query = TrainingScheduleCommand.findOne({ actorId, requestId });
  if (session) query = query.session(session);
  const command = await query;
  if (!command) return null;
  if (
    command.commandType !== commandType ||
    command.payloadFingerprint !== payloadFingerprint
  ) {
    throw commandError(
      409,
      "requestId đã được dùng cho một thao tác khác",
      "REQUEST_ID_REUSED",
    );
  }
  let schedule = null;
  if (command.scheduleId) {
    let scheduleQuery = TrainingSchedule.findById(command.scheduleId);
    if (session) scheduleQuery = scheduleQuery.session(session);
    schedule = await scheduleQuery;
  }
  incrementMetric("schedule.idempotency_hits");
  return {
    schedule,
    count: command.resultCount,
    idempotentReplay: true,
  };
};

const createClaims = async ({ schedule, occurrence, session }) => {
  const claims = buildSlotStarts(
    occurrence.startAt,
    occurrence.endAt,
  ).map((slotStartAt) => ({
    scheduleId: schedule._id,
    trainerId: schedule.trainerId,
    clientId: schedule.clientId,
    occurrenceDateKey: occurrence.occurrenceDateKey,
    slotStartAt,
  }));
  await TrainingSlotClaim.insertMany(claims, { session });
};

const createAudit = async ({
  actor,
  source,
  action,
  scheduleId,
  metadata,
  requestContext,
  session,
}) => {
  await AuditLog.create(
    [
      {
        actorId: actor.id,
        actorRole: actorAuditRole(actor, source),
        action,
        targetType: "training_schedule",
        targetId: scheduleId,
        metadata,
        ...getRequestContext(requestContext),
      },
    ],
    { session },
  );
};

const validateTrainerAccount = async (trainerId, session) => {
  const trainer = await User.findById(trainerId).session(session);
  if (!trainer) {
    throw commandError(404, "Không tìm thấy huấn luyện viên", "TRAINER_NOT_FOUND");
  }
  if (trainer.role === "admin" || trainer.role === "trainer") return trainer;
  const activeSubscription = await TrainerSubscription.exists({
    userId: trainerId,
    status: "active",
    isActive: true,
    endDate: { $gt: new Date() },
  }).session(session);
  if (!activeSubscription) {
    throw commandError(
      403,
      "Tài khoản được chỉ định không có quyền huấn luyện viên",
      "TRAINER_ACCESS_REQUIRED",
    );
  }
  return trainer;
};

const requireTrainerClientRelationship = async ({
  trainerId,
  clientId,
  actor,
  session,
}) => {
  const query = {
    userId: clientId,
    status: "approved",
    sessions: { $gt: 0 },
  };
  if (actor.role === "admin" && String(trainerId) === String(actor.id)) {
    query.$or = [
      { trainerId },
      { trainerId: null },
      { trainerId: { $exists: false } },
    ];
  } else {
    query.trainerId = trainerId;
  }
  const order = await Order.findOne(query)
    .sort({ createdAt: -1 })
    .session(session);
  if (!order) {
    throw commandError(
      403,
      "Khách hàng không thuộc phạm vi quản lý hoặc đã hết buổi tập",
      "TRAINER_CLIENT_FORBIDDEN",
    );
  }
  return order;
};

export const resolveClientTrainer = async ({
  clientId,
  session = null,
}) => {
  let query = Order.findOne({
    userId: clientId,
    status: "approved",
    sessions: { $gt: 0 },
  }).sort({ createdAt: -1 });
  if (session) query = query.session(session);
  const order = await query;
  if (!order) {
    throw commandError(
      403,
      "Bạn chưa có gói tập đã duyệt còn buổi",
      "NO_ACTIVE_ORDER",
    );
  }
  if (order.trainerId) {
    return { trainerId: order.trainerId, order };
  }

  const configuredId = process.env.DEFAULT_ADMIN_TRAINER_ID;
  if (!mongoose.isValidObjectId(configuredId)) {
    throw commandError(
      409,
      "Gói tập chưa được phân công huấn luyện viên",
      "TRAINER_ASSIGNMENT_REQUIRED",
    );
  }
  let trainerQuery = User.findOne({ _id: configuredId, role: "admin" });
  if (session) trainerQuery = trainerQuery.session(session);
  const configuredTrainer = await trainerQuery;
  if (!configuredTrainer) {
    throw commandError(
      409,
      "Huấn luyện viên mặc định chưa được cấu hình hợp lệ",
      "INVALID_DEFAULT_TRAINER",
    );
  }
  return { trainerId: configuredTrainer._id, order };
};

const normalizeTextFields = (input, current = {}) => {
  const exerciseType =
    input.exerciseType === undefined
      ? current.exerciseType
      : String(input.exerciseType).trim();
  const notes =
    input.notes === undefined ? current.notes || "" : String(input.notes).trim();
  const color =
    input.color === undefined ? current.color || "#ff5500" : input.color;
  if (!exerciseType || exerciseType.length > 50) {
    throw commandError(
      400,
      "Loại bài tập phải có từ 1 đến 50 ký tự",
      "INVALID_EXERCISE_TYPE",
    );
  }
  if (notes.length > 200) {
    throw commandError(400, "Ghi chú tối đa 200 ký tự", "INVALID_NOTES");
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(color || ""))) {
    throw commandError(400, "Màu lịch tập không hợp lệ", "INVALID_COLOR");
  }
  return { exerciseType, notes, color };
};

const duplicateConflict = async ({
  error,
  actorId,
  requestId,
  commandType,
  payloadFingerprint,
}) => {
  if (error.code !== 11000) throw error;
  const replay = await findReplay({
    actorId,
    requestId,
    commandType,
    payloadFingerprint,
  });
  if (replay) return replay;
  incrementMetric("schedule.slot_conflicts");
  throw commandError(
    409,
    "Khung giờ hoặc ngày tập vừa được người khác đặt. Vui lòng chọn lại.",
    "SCHEDULE_CONFLICT",
  );
};

export const createTrainingOccurrence = async ({
  actor,
  source,
  input,
  requestContext,
}) => {
  assertRequestId(input.requestId);
  const occurrence = normalizeOccurrenceInput(input);
  const textFields = normalizeTextFields(input, {
    exerciseType:
      source === "client" ? "Tự do (Khách đăng ký)" : undefined,
    color: source === "client" ? "#9ca3af" : "#ff5500",
  });
  const payloadFingerprint = fingerprint({
    commandType: "create",
    source,
    clientId: source === "client" ? actor.id : input.clientId,
    trainerId: input.trainerId || null,
    occurrence,
    ...textFields,
  });
  const prior = await findReplay({
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "create",
    payloadFingerprint,
  });
  if (prior) return prior;

  const session = await mongoose.startSession();
  let schedule;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({
        actorId: actor.id,
        requestId: input.requestId,
        commandType: "create",
        payloadFingerprint,
        session,
      });
      if (replay) {
        schedule = replay.schedule;
        return;
      }

      const clientId = source === "client" ? actor.id : input.clientId;
      if (!mongoose.isValidObjectId(clientId)) {
        throw commandError(400, "clientId không hợp lệ", "INVALID_CLIENT");
      }
      const client = await User.findById(clientId).session(session);
      if (!client) {
        throw commandError(404, "Không tìm thấy khách hàng", "CLIENT_NOT_FOUND");
      }

      let trainerId;
      if (source === "client") {
        ({ trainerId } = await resolveClientTrainer({ clientId, session }));
      } else {
        trainerId =
          actor.role === "admin" && input.trainerId
            ? input.trainerId
            : actor.id;
        if (!mongoose.isValidObjectId(trainerId)) {
          throw commandError(
            400,
            "trainerId không hợp lệ",
            "INVALID_TRAINER",
          );
        }
        await validateTrainerAccount(trainerId, session);
        await requireTrainerClientRelationship({
          trainerId,
          clientId,
          actor,
          session,
        });
      }

      [schedule] = await TrainingSchedule.create(
        [
          {
            trainerId,
            clientId,
            clientName: client.name,
            ...occurrence,
            ...textFields,
            status: "scheduled",
            isActive: true,
            revision: 0,
            createdByType:
              source === "client"
                ? "client"
                : actor.role === "admin"
                  ? "admin"
                  : "trainer",
            requestedBy: actor.id,
            requestId: input.requestId,
          },
        ],
        { session },
      );
      await createClaims({ schedule, occurrence, session });
      await createAudit({
        actor,
        source,
        action: "create_training_schedule",
        scheduleId: schedule._id,
        metadata: {
          requestId: input.requestId,
          occurrenceDateKey: occurrence.occurrenceDateKey,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
        },
        requestContext,
        session,
      });
      await TrainingScheduleCommand.create(
        [
          {
            actorId: actor.id,
            requestId: input.requestId,
            commandType: "create",
            payloadFingerprint,
            scheduleId: schedule._id,
            responseRevision: schedule.revision,
          },
        ],
        { session },
      );
    });
    return { schedule, idempotentReplay: false };
  } catch (error) {
    incrementMetric("schedule.transaction_aborts");
    return await duplicateConflict({
      error,
      actorId: actor.id,
      requestId: input.requestId,
      commandType: "create",
      payloadFingerprint,
    });
  } finally {
    await session.endSession();
  }
};

const assertScheduleAccess = (schedule, actor, source) => {
  if (
    source === "client" &&
    String(schedule.clientId) !== String(actor.id)
  ) {
    throw commandError(
      403,
      "Bạn không có quyền thao tác lịch tập này",
      "SCHEDULE_FORBIDDEN",
    );
  }
  if (
    source === "trainer" &&
    actor.role !== "admin" &&
    String(schedule.trainerId) !== String(actor.id)
  ) {
    throw commandError(
      403,
      "Bạn không có quyền thao tác lịch tập này",
      "SCHEDULE_FORBIDDEN",
    );
  }
};

export const rescheduleTrainingOccurrence = async ({
  actor,
  source,
  scheduleId,
  input,
  requestContext,
}) => {
  assertRequestId(input.requestId);
  assertRevision(input.revision);
  const payloadFingerprint = fingerprint({
    commandType: "reschedule",
    source,
    scheduleId,
    input,
  });
  const prior = await findReplay({
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "reschedule",
    payloadFingerprint,
  });
  if (prior) return prior;

  const session = await mongoose.startSession();
  let updatedSchedule;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({
        actorId: actor.id,
        requestId: input.requestId,
        commandType: "reschedule",
        payloadFingerprint,
        session,
      });
      if (replay) {
        updatedSchedule = replay.schedule;
        return;
      }

      const schedule = await TrainingSchedule.findById(scheduleId).session(
        session,
      );
      if (!schedule) {
        throw commandError(404, "Không tìm thấy lịch tập", "SCHEDULE_NOT_FOUND");
      }
      assertScheduleAccess(schedule, actor, source);
      if (schedule.status !== "scheduled" || !schedule.isActive) {
        throw commandError(
          409,
          "Chỉ có thể sửa lịch đang hoạt động",
          "SCHEDULE_NOT_ACTIVE",
        );
      }
      if (schedule.revision !== input.revision) {
        incrementMetric("schedule.revision_conflicts");
        throw commandError(
          409,
          "Lịch đã thay đổi. Vui lòng tải lại dữ liệu.",
          "STALE_REVISION",
        );
      }

      const now = new Date();
      if (source === "client") {
        const lastEdit = schedule.lastClientEditAt || schedule.lastClientEdit;
        if (lastEdit && now.getTime() - lastEdit.getTime() < CLIENT_EDIT_COOLDOWN_MS) {
          throw commandError(
            429,
            "Bạn chỉ có thể chỉnh sửa lịch này một lần mỗi 24 giờ",
            "CLIENT_EDIT_COOLDOWN",
          );
        }
      }

      const clientId =
        source === "client"
          ? schedule.clientId
          : input.clientId || schedule.clientId;
      const trainerId =
        source === "trainer" && actor.role === "admin" && input.trainerId
          ? input.trainerId
          : schedule.trainerId;
      if (
        !mongoose.isValidObjectId(clientId) ||
        !mongoose.isValidObjectId(trainerId)
      ) {
        throw commandError(
          400,
          "Khách hàng hoặc huấn luyện viên không hợp lệ",
          "INVALID_ASSIGNMENT",
        );
      }

      const client = await User.findById(clientId).session(session);
      if (!client) {
        throw commandError(404, "Không tìm thấy khách hàng", "CLIENT_NOT_FOUND");
      }
      if (source === "client") {
        const assignment = await resolveClientTrainer({ clientId, session });
        if (String(assignment.trainerId) !== String(schedule.trainerId)) {
          throw commandError(
            409,
            "Phân công huấn luyện viên đã thay đổi. Vui lòng tải lại.",
            "TRAINER_ASSIGNMENT_CHANGED",
          );
        }
      } else {
        await validateTrainerAccount(trainerId, session);
        await requireTrainerClientRelationship({
          trainerId,
          clientId,
          actor,
          session,
        });
      }

      const occurrence = normalizeOccurrenceInput({
        occurrenceDateKey:
          input.occurrenceDateKey || schedule.occurrenceDateKey,
        dayOfWeek:
          input.dayOfWeek === undefined
            ? undefined
            : input.dayOfWeek,
        startTime: input.startTime || schedule.startTime,
        endTime: input.endTime || schedule.endTime,
      });
      const textFields = normalizeTextFields(input, schedule);

      await TrainingSlotClaim.deleteMany({
        scheduleId: schedule._id,
      }).session(session);
      const claimSchedule = {
        _id: schedule._id,
        trainerId,
        clientId,
      };
      await createClaims({
        schedule: claimSchedule,
        occurrence,
        session,
      });

      const update = {
        trainerId,
        clientId,
        clientName: client.name,
        ...occurrence,
        ...textFields,
        reminderSent: false,
        lastReminderOccurrenceKey: "",
        lastReminderSentAt: null,
        reminderClaimedOccurrenceKey: "",
        reminderClaimedAt: null,
      };
      if (source === "client") {
        update.lastClientEdit = now;
        update.lastClientEditAt = now;
      }
      updatedSchedule = await TrainingSchedule.findOneAndUpdate(
        {
          _id: schedule._id,
          revision: input.revision,
          status: "scheduled",
          isActive: true,
        },
        {
          $set: update,
          $inc: { revision: 1 },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );
      if (!updatedSchedule) {
        incrementMetric("schedule.revision_conflicts");
        throw commandError(
          409,
          "Lịch đã thay đổi. Vui lòng tải lại dữ liệu.",
          "STALE_REVISION",
        );
      }

      await createAudit({
        actor,
        source,
        action: "reschedule_training_schedule",
        scheduleId: schedule._id,
        metadata: {
          requestId: input.requestId,
          fromRevision: input.revision,
          toRevision: updatedSchedule.revision,
          fromOccurrenceDateKey: schedule.occurrenceDateKey,
          toOccurrenceDateKey: occurrence.occurrenceDateKey,
          fromStartAt: schedule.startAt,
          toStartAt: occurrence.startAt,
        },
        requestContext,
        session,
      });
      await TrainingScheduleCommand.create(
        [
          {
            actorId: actor.id,
            requestId: input.requestId,
            commandType: "reschedule",
            payloadFingerprint,
            scheduleId: schedule._id,
            responseRevision: updatedSchedule.revision,
          },
        ],
        { session },
      );
    });
    return { schedule: updatedSchedule, idempotentReplay: false };
  } catch (error) {
    incrementMetric("schedule.transaction_aborts");
    return await duplicateConflict({
      error,
      actorId: actor.id,
      requestId: input.requestId,
      commandType: "reschedule",
      payloadFingerprint,
    });
  } finally {
    await session.endSession();
  }
};

const transitionTrainingOccurrence = async ({
  actor,
  source,
  scheduleId,
  input,
  commandType,
  targetStatus,
  auditAction,
  requestContext,
}) => {
  assertRequestId(input.requestId);
  assertRevision(input.revision);
  const reason = String(input.reason || "").trim();
  if (reason.length > 300) {
    throw commandError(400, "Lý do tối đa 300 ký tự", "INVALID_REASON");
  }
  const payloadFingerprint = fingerprint({
    commandType,
    source,
    scheduleId,
    revision: input.revision,
    reason,
  });
  const prior = await findReplay({
    actorId: actor.id,
    requestId: input.requestId,
    commandType,
    payloadFingerprint,
  });
  if (prior) return prior;

  const session = await mongoose.startSession();
  let updatedSchedule;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({
        actorId: actor.id,
        requestId: input.requestId,
        commandType,
        payloadFingerprint,
        session,
      });
      if (replay) {
        updatedSchedule = replay.schedule;
        return;
      }
      const schedule = await TrainingSchedule.findById(scheduleId).session(
        session,
      );
      if (!schedule) {
        throw commandError(404, "Không tìm thấy lịch tập", "SCHEDULE_NOT_FOUND");
      }
      assertScheduleAccess(schedule, actor, source);
      if (source === "client" && commandType === "complete") {
        throw commandError(
          403,
          "Khách hàng không thể hoàn thành lịch tập",
          "SCHEDULE_FORBIDDEN",
        );
      }
      if (
        schedule.status !== "scheduled" ||
        !schedule.isActive ||
        schedule.revision !== input.revision
      ) {
        incrementMetric("schedule.revision_conflicts");
        throw commandError(
          409,
          "Lịch đã thay đổi hoặc không còn hoạt động",
          "STALE_REVISION",
        );
      }

      const now = new Date();
      const statusUpdate =
        targetStatus === "cancelled"
          ? {
              cancelledAt: now,
              cancelledBy: actor.id,
              cancellationReason: reason,
            }
          : {
              completedAt: now,
              completedBy: actor.id,
            };
      updatedSchedule = await TrainingSchedule.findOneAndUpdate(
        {
          _id: schedule._id,
          revision: input.revision,
          status: "scheduled",
          isActive: true,
        },
        {
          $set: {
            status: targetStatus,
            isActive: false,
            ...statusUpdate,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedSchedule) {
        incrementMetric("schedule.revision_conflicts");
        throw commandError(
          409,
          "Lịch đã thay đổi. Vui lòng tải lại dữ liệu.",
          "STALE_REVISION",
        );
      }
      await TrainingSlotClaim.deleteMany({
        scheduleId: schedule._id,
      }).session(session);
      await createAudit({
        actor,
        source,
        action: auditAction,
        scheduleId: schedule._id,
        metadata: {
          requestId: input.requestId,
          fromRevision: input.revision,
          toRevision: updatedSchedule.revision,
          reason,
        },
        requestContext,
        session,
      });
      await TrainingScheduleCommand.create(
        [
          {
            actorId: actor.id,
            requestId: input.requestId,
            commandType,
            payloadFingerprint,
            scheduleId: schedule._id,
            responseRevision: updatedSchedule.revision,
          },
        ],
        { session },
      );
    });
    return { schedule: updatedSchedule, idempotentReplay: false };
  } catch (error) {
    incrementMetric("schedule.transaction_aborts");
    return await duplicateConflict({
      error,
      actorId: actor.id,
      requestId: input.requestId,
      commandType,
      payloadFingerprint,
    });
  } finally {
    await session.endSession();
  }
};

export const cancelTrainingOccurrence = (options) =>
  transitionTrainingOccurrence({
    ...options,
    commandType: "cancel",
    targetStatus: "cancelled",
    auditAction: "cancel_training_schedule",
  });

export const completeTrainingOccurrence = (options) =>
  transitionTrainingOccurrence({
    ...options,
    commandType: "complete",
    targetStatus: "completed",
    auditAction: "complete_training_schedule",
  });

export const cancelAllTrainerOccurrences = async ({
  actor,
  input,
  requestContext,
}) => {
  assertRequestId(input.requestId);
  const payloadFingerprint = fingerprint({
    commandType: "cancel_all",
    actorId: actor.id,
  });
  const prior = await findReplay({
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "cancel_all",
    payloadFingerprint,
  });
  if (prior) return prior;

  const session = await mongoose.startSession();
  let count = 0;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({
        actorId: actor.id,
        requestId: input.requestId,
        commandType: "cancel_all",
        payloadFingerprint,
        session,
      });
      if (replay) {
        count = replay.count || 0;
        return;
      }

      const schedules = await TrainingSchedule.find({
        trainerId: actor.id,
        status: "scheduled",
        isActive: true,
      })
        .select("_id revision")
        .session(session);
      count = schedules.length;
      const scheduleIds = schedules.map((schedule) => schedule._id);
      if (scheduleIds.length > 0) {
        const now = new Date();
        await TrainingSchedule.updateMany(
          {
            _id: { $in: scheduleIds },
            status: "scheduled",
            isActive: true,
          },
          {
            $set: {
              status: "cancelled",
              isActive: false,
              cancelledAt: now,
              cancelledBy: actor.id,
              cancellationReason: "Trainer cancelled all active occurrences",
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        await TrainingSlotClaim.deleteMany({
          scheduleId: { $in: scheduleIds },
        }).session(session);
        await AuditLog.insertMany(
          scheduleIds.map((scheduleId) => ({
            actorId: actor.id,
            actorRole: actorAuditRole(actor, "trainer"),
            action: "cancel_all_training_schedules",
            targetType: "training_schedule",
            targetId: scheduleId,
            metadata: { requestId: input.requestId },
            ...getRequestContext(requestContext),
          })),
          { session },
        );
      }
      await TrainingScheduleCommand.create(
        [
          {
            actorId: actor.id,
            requestId: input.requestId,
            commandType: "cancel_all",
            payloadFingerprint,
            resultCount: count,
          },
        ],
        { session },
      );
    });
    return { count, idempotentReplay: false };
  } catch (error) {
    incrementMetric("schedule.transaction_aborts");
    return await duplicateConflict({
      error,
      actorId: actor.id,
      requestId: input.requestId,
      commandType: "cancel_all",
      payloadFingerprint,
    });
  } finally {
    await session.endSession();
  }
};
