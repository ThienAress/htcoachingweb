import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../models/WeeklyCheckinRevision.js";
import { incrementMetric } from "../observability/metrics.js";
import { excludeActiveCoachingClients } from "./todayRetentionGuard.service.js";
import {
  deleteCoachingCommentsForTargets,
} from "./coachingCommentPrivacy.service.js";
import { weeklyCheckinError } from "./weeklyCheckinAccess.service.js";
import {
  toWeeklyCheckinDto,
  toWeeklyCheckinRevisionDto,
} from "./weeklyCheckinDto.service.js";

const BATCH_SIZE = 100;

export const exportWeeklyCheckinData = async ({
  clientId,
  page = 1,
  limit = 50,
}) => {
  const filter = { clientId };
  const [checkins, total] = await Promise.all([
    WeeklyCheckin.find(filter)
      .sort({ weekStartDateKey: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WeeklyCheckin.countDocuments(filter),
  ]);
  const checkinIds = checkins.map((checkin) => checkin._id);
  const revisions = await WeeklyCheckinRevision.find({
    clientId,
    checkinId: { $in: checkinIds },
  })
    .select("-payloadFingerprint -requestId")
    .sort({ changedAt: 1 })
    .lean();
  return {
    checkins: checkins.map(toWeeklyCheckinDto),
    revisions: revisions.map(toWeeklyCheckinRevisionDto),
    pagination: { page, limit, total },
  };
};

export const deleteWeeklyCheckinData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let counts = { checkins: 0, revisions: 0 };
  try {
    await session.withTransaction(async () => {
      const targets = await WeeklyCheckin.find({ clientId: actor.id })
        .select("_id")
        .session(session)
        .lean();
      await deleteCoachingCommentsForTargets({
        targets: targets.map((target) => ({
          targetType: "weekly_checkin",
          targetId: target._id,
        })),
        session,
      });
      const revisions = await WeeklyCheckinRevision.deleteMany({
        clientId: actor.id,
      }).session(session);
      const checkins = await WeeklyCheckin.deleteMany({
        clientId: actor.id,
      }).session(session);
      counts = {
        checkins: checkins.deletedCount,
        revisions: revisions.deletedCount,
      };
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.role === "admin" ? "admin" : "user",
            action: "delete_weekly_checkin_data",
            targetType: "user",
            targetId: actor.id,
            metadata: counts,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return counts;
};

const assertAdminActor = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw weeklyCheckinError(
      503,
      "Retention actor chưa cấu hình",
      "WEEKLY_CHECKIN_RETENTION_ACTOR_REQUIRED",
    );
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" })
    .select("_id")
    .lean();
  if (!actor) {
    throw weeklyCheckinError(
      403,
      "Retention actor phải là admin",
      "WEEKLY_CHECKIN_RETENTION_ADMIN_REQUIRED",
    );
  }
};

export const runWeeklyCheckinRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_WEEKLY_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_WEEKLY_RETENTION_ACTOR_ID,
} = {}) => {
  if (
    enforce &&
    process.env.TODAY_WEEKLY_RETENTION_ENFORCE !== "true"
  ) {
    throw weeklyCheckinError(
      503,
      "Weekly Check-in retention enforcement chưa được bật",
      "WEEKLY_CHECKIN_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
  const expired = await WeeklyCheckin.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length > 0) {
    incrementMetric("weekly_checkin.retention_candidates", candidates.length);
  }
  if (!enforce) {
    return { dryRun: true, candidates: candidates.length, deleted: 0 };
  }
  await assertAdminActor(actorId);
  if (candidates.length === 0) {
    return { dryRun: false, candidates: 0, deleted: 0 };
  }
  const session = await mongoose.startSession();
  let deletable = candidates;
  try {
    await session.withTransaction(async () => {
      deletable = await excludeActiveCoachingClients(candidates, { session });
      const ids = deletable.map((checkin) => checkin._id);
      if (ids.length === 0) return;
      await deleteCoachingCommentsForTargets({
        targets: ids.map((targetId) => ({
          targetType: "weekly_checkin",
          targetId,
        })),
        session,
      });
      await WeeklyCheckinRevision.deleteMany({
        checkinId: { $in: ids },
      }).session(session);
      await WeeklyCheckin.deleteMany({ _id: { $in: ids } }).session(session);
      await AuditLog.create(
        deletable.map((checkin) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_weekly_checkin",
          targetType: "weekly_checkin",
          targetId: checkin._id,
          metadata: { policy: "today-weekly-checkin-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletable.length > 0) {
    incrementMetric("weekly_checkin.retention_deletions", deletable.length);
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletable.length,
  };
};
