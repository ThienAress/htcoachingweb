import mongoose from "mongoose";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertMonthWeekPeriodKey,
  assertTrainerWeeklyCheckinRead,
  assertWeeklyCheckinWritesEnabled,
  weeklyCheckinError,
} from "./weeklyCheckinAccess.service.js";
import {
  createWeeklyCheckinRevision,
  findWeeklyCheckinReplay,
} from "./weeklyCheckinCommand.service.js";
import { toWeeklyCheckinDto } from "./weeklyCheckinDto.service.js";
import {
  buildWeeklyCheckinChanges,
  normalizeTrainerReview,
  weeklyCheckinFingerprint,
} from "./weeklyCheckinPatch.service.js";
import { createInAppNotification } from "./inAppNotification.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const resultDto = (result) => ({
  data: toWeeklyCheckinDto(result.checkin),
  idempotentReplay: Boolean(result.idempotentReplay),
});
const stale = () =>
  weeklyCheckinError(
    409,
    "Weekly Check-in đã thay đổi, vui lòng tải bản mới",
    "STALE_WEEKLY_CHECKIN_REVISION",
  );

export const reviewWeeklyCheckin = async ({
  actor,
  clientId,
  weekStartDateKey,
  expectedRevision,
  requestId,
  review,
  now = new Date(),
}) => {
  assertWeeklyCheckinWritesEnabled();
  assertMonthWeekPeriodKey(weekStartDateKey);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw weeklyCheckinError(400, "expectedRevision không hợp lệ", "INVALID_REVISION");
  }
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw weeklyCheckinError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
  const normalizedReview = normalizeTrainerReview(review);
  const payloadFingerprint = weeklyCheckinFingerprint({
    action: "review",
    clientId: String(clientId),
    weekStartDateKey,
    expectedRevision,
    review: normalizedReview,
  });
  const prior = await findWeeklyCheckinReplay({
    actorId: actor.id,
    requestId,
    action: "review",
    payloadFingerprint,
  });
  if (prior) return resultDto(prior);

  const session = await mongoose.startSession();
  let result;
  let didSave = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findWeeklyCheckinReplay({
        actorId: actor.id,
        requestId,
        action: "review",
        payloadFingerprint,
        session,
      });
      if (replay) {
        result = replay;
        return;
      }
      await assertTrainerWeeklyCheckinRead({ actor, clientId, session });
      const checkin = await WeeklyCheckin.findOne({
        clientId,
        weekStartDateKey,
      }).session(session);
      if (!checkin) {
        throw weeklyCheckinError(404, "Không tìm thấy Weekly Check-in", "CHECKIN_NOT_FOUND");
      }
      if (checkin.revision !== expectedRevision) {
        incrementMetric("weekly_checkin.revision_conflicts");
        throw stale();
      }
      if (!["submitted", "reviewed"].includes(checkin.status)) {
        throw weeklyCheckinError(409, "Check-in chưa được gửi", "CHECKIN_NOT_SUBMITTED");
      }
      const setFields = {
        status: "reviewed",
        trainerReview: {
          trainerId: actor.id,
          ...normalizedReview,
          reviewedAt: now,
        },
      };
      const changes = buildWeeklyCheckinChanges(checkin, setFields);
      const updated = await WeeklyCheckin.findOneAndUpdate(
        { _id: checkin._id, revision: expectedRevision },
        { $set: setFields, $inc: { revision: 1 } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updated) throw stale();
      await createWeeklyCheckinRevision({
        checkin: updated,
        actor,
        action: "review",
        reason: "",
        requestId,
        payloadFingerprint,
        changes,
        session,
      });
      await createInAppNotification({
        recipientId: clientId,
        actorId: actor.id,
        clientId,
        type: "weekly_reviewed",
        targetType: "weekly_checkin",
        targetId: updated._id,
        dedupeKey:
          "weekly-checkin:reviewed:" +
          updated._id +
          ":" +
          updated.revision,
        session,
      });
      didSave = true;
      result = { checkin: updated, idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const replay = await findWeeklyCheckinReplay({
      actorId: actor.id,
      requestId,
      action: "review",
      payloadFingerprint,
    });
    if (!replay) throw stale();
    result = replay;
  } finally {
    await session.endSession();
  }
  if (didSave) incrementMetric("weekly_checkin.reviews");
  return resultDto(result);
};
