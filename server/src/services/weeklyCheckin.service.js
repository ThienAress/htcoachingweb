import mongoose from "mongoose";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertWeeklyCheckinEditWindow,
  assertWeeklyCheckinWritesEnabled,
  resolveWeeklyCheckinWriteAccess,
  weeklyCheckinError,
} from "./weeklyCheckinAccess.service.js";
import {
  createWeeklyCheckinRevision,
  findWeeklyCheckinReplay,
} from "./weeklyCheckinCommand.service.js";
import { toWeeklyCheckinDto } from "./weeklyCheckinDto.service.js";
import {
  buildWeeklyCheckinChanges,
  normalizeWeeklyCheckinPatch,
  weeklyCheckinFingerprint,
} from "./weeklyCheckinPatch.service.js";
import { createInAppNotification } from "./inAppNotification.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertCommandInput = ({ expectedRevision, requestId }) => {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw weeklyCheckinError(400, "expectedRevision không hợp lệ", "INVALID_REVISION");
  }
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw weeklyCheckinError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
};

const stale = () =>
  weeklyCheckinError(
    409,
    "Weekly Check-in đã thay đổi, vui lòng tải bản mới",
    "STALE_WEEKLY_CHECKIN_REVISION",
  );

const replayResult = (result) => ({
  data: toWeeklyCheckinDto(result.checkin),
  idempotentReplay: Boolean(result.idempotentReplay),
});

const applyClientCommand = async ({
  actor,
  weekStartDateKey,
  expectedRevision,
  requestId,
  patch,
  action,
  reason = "",
  now = new Date(),
}) => {
  assertWeeklyCheckinWritesEnabled();
  if (actor.role !== "user") {
    throw weeklyCheckinError(403, "Chỉ khách hàng được sửa check-in", "CLIENT_ONLY");
  }
  assertWeeklyCheckinEditWindow(weekStartDateKey, now);
  assertCommandInput({ expectedRevision, requestId });
  const normalizedReason = String(reason || "").trim();
  if (action === "correction" && normalizedReason.length < 3) {
    throw weeklyCheckinError(
      400,
      "Correction cần lý do từ 3 đến 500 ký tự",
      "CORRECTION_REASON_REQUIRED",
    );
  }
  if (normalizedReason.length > 500) {
    throw weeklyCheckinError(400, "Lý do quá dài", "INVALID_REASON");
  }
  const patchFields =
    action === "submit" ? {} : normalizeWeeklyCheckinPatch(patch);
  const payloadFingerprint = weeklyCheckinFingerprint({
    action,
    weekStartDateKey,
    expectedRevision,
    patchFields,
    reason: normalizedReason,
  });
  const prior = await findWeeklyCheckinReplay({
    actorId: actor.id,
    requestId,
    action,
    payloadFingerprint,
  });
  if (prior) return replayResult(prior);

  const session = await mongoose.startSession();
  let result;
  let didSave = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findWeeklyCheckinReplay({
        actorId: actor.id,
        requestId,
        action,
        payloadFingerprint,
        session,
      });
      if (replay) {
        result = replay;
        return;
      }
      const assignment = await resolveWeeklyCheckinWriteAccess({
        clientId: actor.id,
        session,
      });
      const checkin = await WeeklyCheckin.findOne({
        clientId: actor.id,
        weekStartDateKey,
      }).session(session);
      if (!checkin && action !== "update") {
        throw weeklyCheckinError(404, "Chưa có Weekly Check-in", "CHECKIN_NOT_FOUND");
      }
      if ((checkin && checkin.revision !== expectedRevision) ||
          (!checkin && expectedRevision !== 0)) {
        incrementMetric("weekly_checkin.revision_conflicts");
        throw stale();
      }
      if (checkin && checkin.status !== "draft" && action === "update") {
        throw weeklyCheckinError(
          409,
          "Check-in đã gửi, hãy dùng correction có lý do",
          "WEEKLY_CHECKIN_SUBMITTED",
        );
      }
      if (action === "correction" && !["submitted", "reviewed"].includes(checkin.status)) {
        throw weeklyCheckinError(
          409,
          "Chỉ có thể correction check-in đã gửi",
          "WEEKLY_CHECKIN_NOT_SUBMITTED",
        );
      }
      if (action === "submit" && checkin.status !== "draft") {
        throw weeklyCheckinError(
          409,
          "Weekly Check-in đã được gửi",
          "WEEKLY_CHECKIN_ALREADY_SUBMITTED",
        );
      }
      const base =
        checkin ||
        new WeeklyCheckin({
          clientId: actor.id,
          trainerIdAtCreation: assignment.trainerId,
          weekStartDateKey,
        });
      const setFields =
        action === "submit"
          ? { status: "submitted", submittedAt: now }
          : { ...patchFields };
      if (action === "correction" && checkin.status === "reviewed") {
        setFields.status = "submitted";
        setFields.trainerReview = null;
      }
      const changes = buildWeeklyCheckinChanges(base, setFields);
      if (changes.length === 0) {
        result = { checkin: base, idempotentReplay: false };
        return;
      }
      let updated;
      let revisionAction = action;
      if (!checkin) {
        for (const [path, value] of Object.entries(setFields)) base.set(path, value);
        base.revision = 1;
        updated = await base.save({ session });
        revisionAction = "create";
      } else {
        updated = await WeeklyCheckin.findOneAndUpdate(
          { _id: checkin._id, revision: expectedRevision },
          { $set: setFields, $inc: { revision: 1 } },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!updated) {
          incrementMetric("weekly_checkin.revision_conflicts");
          throw stale();
        }
      }
      await createWeeklyCheckinRevision({
        checkin: updated,
        actor,
        action: revisionAction,
        reason: normalizedReason,
        requestId,
        payloadFingerprint,
        changes,
        session,
      });
      if (action === "submit" || action === "correction") {
        await createInAppNotification({
          recipientId: assignment.trainerId,
          actorId: actor.id,
          clientId: actor.id,
          type:
            action === "submit"
              ? "weekly_submitted"
              : "weekly_corrected",
          targetType: "weekly_checkin",
          targetId: updated._id,
          dedupeKey:
            "weekly-checkin:" +
            action +
            ":" +
            updated._id +
            ":" +
            updated.revision,
          session,
        });
      }
      didSave = true;
      result = { checkin: updated, idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const replay = await findWeeklyCheckinReplay({
        actorId: actor.id,
        requestId,
        action,
        payloadFingerprint,
      });
      if (replay) result = replay;
      else {
        incrementMetric("weekly_checkin.revision_conflicts");
        throw stale();
      }
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
  if (didSave) incrementMetric("weekly_checkin.saves");
  return replayResult(result);
};

export const saveWeeklyCheckin = (input) =>
  applyClientCommand({ ...input, action: "update" });
export const submitWeeklyCheckin = (input) =>
  applyClientCommand({ ...input, action: "submit" });
export const correctWeeklyCheckin = (input) =>
  applyClientCommand({ ...input, action: "correction" });
