import mongoose from "mongoose";

import CoachingDay from "../models/CoachingDay.js";
import Order from "../models/Order.js";
import TrainerTransfer from "../models/TrainerTransfer.js";
import TrainerTransferLock from "../models/TrainerTransferLock.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { transferError } from "./trainerTransferErrors.js";
import {
  buildTrainerTransferPreview,
  loadTrainerTransferSnapshot,
  serializeTrainerTransferPreview,
} from "./trainerTransferQuery.service.js";
import {
  listActiveTrainerAssignments,
  listRecentTrainerOrders,
} from "./trainerAssignmentRead.service.js";

export {
  buildTrainerTransferPreview,
  listActiveTrainerAssignments,
  listRecentTrainerOrders,
};

const validateCommandText = ({ reason, requestId, previewToken }) => {
  const normalizedReason = String(reason || "").trim();
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedReason.length < 10 || normalizedReason.length > 500) {
    throw transferError(400, "INVALID_TRANSFER_REASON", "Lý do chuyển HLV phải có từ 10 đến 500 ký tự");
  }
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(normalizedRequestId)) {
    throw transferError(400, "INVALID_TRANSFER_REQUEST_ID", "Mã yêu cầu chuyển HLV không hợp lệ");
  }
  if (!/^[a-f0-9]{64}$/.test(String(previewToken || ""))) {
    throw transferError(400, "INVALID_TRANSFER_PREVIEW", "Cần xem trước lại trước khi chuyển HLV");
  }
  return { normalizedReason, normalizedRequestId };
};

const assertReplayMatches = (transfer, command) => {
  const matches =
    String(transfer.clientId) === String(command.clientId) &&
    String(transfer.fromTrainerId) === String(command.fromTrainerId) &&
    String(transfer.toTrainerId) === String(command.toTrainerId) &&
    String(transfer.requestedBy) === String(command.actorId) &&
    transfer.reason === command.reason &&
    transfer.previewToken === command.previewToken;
  if (!matches) {
    throw transferError(409, "TRANSFER_REQUEST_ID_CONFLICT", "Mã yêu cầu đã được dùng cho lần chuyển khác");
  }
};

const assertMutationCount = (result, expected) => {
  if (result.modifiedCount !== expected) {
    throw transferError(409, "TRAINER_TRANSFER_STALE", "Dữ liệu đã thay đổi, vui lòng xem trước lại");
  }
};

export const executeTrainerTransfer = async (command) => {
  const { normalizedReason, normalizedRequestId } = validateCommandText(command);
  if (!mongoose.isValidObjectId(command.actorId)) {
    throw transferError(400, "INVALID_TRANSFER_ACTOR", "Tài khoản thực hiện không hợp lệ");
  }

  const normalizedCommand = {
    ...command,
    reason: normalizedReason,
    requestId: normalizedRequestId,
  };
  const existing = await TrainerTransfer.findOne({ requestId: normalizedRequestId });
  if (existing) {
    assertReplayMatches(existing, normalizedCommand);
    return { transfer: existing, replayed: true };
  }

  const session = await mongoose.startSession();
  let transfer = null;
  try {
    await session.withTransaction(async () => {
      const replay = await TrainerTransfer.findOne({ requestId: normalizedRequestId }).session(session);
      if (replay) {
        assertReplayMatches(replay, normalizedCommand);
        transfer = replay;
        return;
      }

      const snapshot = await loadTrainerTransferSnapshot({ ...command, session });
      if (snapshot.previewToken !== command.previewToken) {
        throw transferError(409, "TRAINER_TRANSFER_STALE", "Dữ liệu đã thay đổi, vui lòng xem trước lại");
      }
      const preview = serializeTrainerTransferPreview(snapshot);
      if (preview.capacity.exceeded) {
        throw transferError(409, "TRAINER_CAPACITY_EXCEEDED", "HLV mới đã đạt giới hạn số học viên của gói");
      }
      if (snapshot.slotConflictCount > 0) {
        throw transferError(409, "TARGET_SCHEDULE_CONFLICT", "HLV mới đang có lịch trùng giờ với khách hàng");
      }

      const lock = await TrainerTransferLock.findOneAndUpdate(
        { _id: snapshot.ids.toTrainerId, revision: snapshot.lockRevision },
        { $inc: { revision: 1 } },
        {
          returnDocument: "after",
          upsert: snapshot.lockRevision === 0,
          setDefaultsOnInsert: true,
          session,
        },
      );
      if (!lock) {
        throw transferError(409, "TRAINER_TRANSFER_STALE", "Có lần chuyển khác vừa hoàn tất, vui lòng xem trước lại");
      }

      const orderIds = snapshot.orders.map(({ _id }) => _id);
      const scheduleIds = snapshot.schedules.map(({ _id }) => _id);
      const workoutIds = snapshot.workoutPlans.map(({ _id }) => _id);
      const coachingIds = snapshot.coachingDays.map(({ _id }) => _id);
      const orders = await Order.updateMany(
        { _id: { $in: orderIds }, trainerId: snapshot.ids.fromTrainerId },
        { $set: { trainerId: snapshot.ids.toTrainerId } },
        { session },
      );
      const schedules = await TrainingSchedule.updateMany(
        { _id: { $in: scheduleIds }, trainerId: snapshot.ids.fromTrainerId },
        { $set: { trainerId: snapshot.ids.toTrainerId } },
        { session },
      );
      const claims = await TrainingSlotClaim.updateMany(
        { scheduleId: { $in: scheduleIds }, trainerId: snapshot.ids.fromTrainerId },
        { $set: { trainerId: snapshot.ids.toTrainerId } },
        { session },
      );
      const workouts = await WorkoutPlan.updateMany(
        { _id: { $in: workoutIds }, trainerId: snapshot.ids.fromTrainerId },
        { $set: { trainerId: snapshot.ids.toTrainerId } },
        { session },
      );
      const coachingDays = await CoachingDay.updateMany(
        { _id: { $in: coachingIds }, trainerId: snapshot.ids.fromTrainerId },
        { $set: { trainerId: snapshot.ids.toTrainerId } },
        { session },
      );
      assertMutationCount(orders, orderIds.length);
      assertMutationCount(schedules, scheduleIds.length);
      assertMutationCount(claims, snapshot.claims.length);
      assertMutationCount(workouts, workoutIds.length);
      assertMutationCount(coachingDays, coachingIds.length);

      [transfer] = await TrainerTransfer.create(
        [{
          requestId: normalizedRequestId,
          clientId: snapshot.ids.clientId,
          fromTrainerId: snapshot.ids.fromTrainerId,
          toTrainerId: snapshot.ids.toTrainerId,
          requestedBy: normalizedCommand.actorId,
          reason: normalizedReason,
          previewToken: command.previewToken,
          affected: preview.affected,
          retained: preview.retained,
          completedAt: new Date(),
        }],
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      const replay = await TrainerTransfer.findOne({ requestId: normalizedRequestId });
      if (replay) {
        assertReplayMatches(replay, normalizedCommand);
        return { transfer: replay, replayed: true };
      }
      throw transferError(409, "TRAINER_TRANSFER_STALE", "Có lần chuyển khác vừa hoàn tất, vui lòng xem trước lại");
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return { transfer, replayed: false };
};
