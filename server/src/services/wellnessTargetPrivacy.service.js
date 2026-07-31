import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import WellnessTarget from "../models/WellnessTarget.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  wellnessTargetError,
} from "./wellnessTargetAccess.service.js";
import { toWellnessTargetDto } from "./wellnessTargetDto.service.js";
import {
  excludeActiveCoachingClients,
} from "./todayRetentionGuard.service.js";

const BATCH_SIZE = 100;

export const exportWellnessTargetData = async ({
  clientId,
  page = 1,
  limit = 50,
}) => {
  const [documents, total] = await Promise.all([
    WellnessTarget.find({ clientId })
      .sort({ version: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WellnessTarget.countDocuments({ clientId }),
  ]);
  return {
    items: documents.map(toWellnessTargetDto),
    pagination: { page, limit, total },
  };
};

export const deleteWellnessTargetData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let targets = 0;
  try {
    await session.withTransaction(async () => {
      const deleted = await WellnessTarget.deleteMany({
        clientId: actor.id,
      }).session(session);
      targets = deleted.deletedCount;
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.role,
            action: "delete_wellness_target_data",
            targetType: "user",
            targetId: actor.id,
            metadata: { targets },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return { targets };
};

const assertEnforcement = () => {
  if (process.env.TODAY_WELLNESS_TARGET_RETENTION_ENFORCE !== "true") {
    throw wellnessTargetError(
      503,
      "Wellness Target retention enforcement chưa được bật",
      "WELLNESS_TARGET_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
};

const assertAdminActor = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw wellnessTargetError(
      503,
      "Retention actor chưa cấu hình",
      "WELLNESS_TARGET_RETENTION_ACTOR_REQUIRED",
    );
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" })
    .select("_id")
    .lean();
  if (!actor) {
    throw wellnessTargetError(
      403,
      "Retention actor phải là admin",
      "WELLNESS_TARGET_RETENTION_ADMIN_REQUIRED",
    );
  }
};

export const runWellnessTargetRetentionSweep = async ({
  now = new Date(),
  enforce =
    process.env.TODAY_WELLNESS_TARGET_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_WELLNESS_TARGET_RETENTION_ACTOR_ID,
} = {}) => {
  if (enforce) assertEnforcement();
  const expired = await WellnessTarget.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length) {
    incrementMetric("wellness_target.retention_candidates", candidates.length);
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
      const ids = deletable.map((target) => target._id);
      if (ids.length === 0) return;
      await WellnessTarget.deleteMany({ _id: { $in: ids } }).session(session);
      await AuditLog.create(
        deletable.map((target) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_wellness_target",
          targetType: "wellness_target",
          targetId: target._id,
          metadata: { policy: "today-wellness-target-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletable.length) {
    incrementMetric("wellness_target.retention_deletions", deletable.length);
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletable.length,
  };
};
