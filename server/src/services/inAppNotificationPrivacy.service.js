import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import InAppNotification from "../models/InAppNotification.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import { notificationError } from "./inAppNotification.service.js";
import {
  excludeActiveCoachingClients,
} from "./todayRetentionGuard.service.js";

const BATCH_SIZE = 100;

const assertEnforcement = () => {
  if (process.env.TODAY_NOTIFICATION_RETENTION_ENFORCE !== "true") {
    throw notificationError(
      503,
      "Notification retention enforcement chưa được bật",
      "NOTIFICATION_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
};

const assertAdminActor = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw notificationError(
      503,
      "Retention actor chưa cấu hình",
      "NOTIFICATION_RETENTION_ACTOR_REQUIRED",
    );
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" })
    .select("_id")
    .lean();
  if (!actor) {
    throw notificationError(
      403,
      "Retention actor phải là admin",
      "NOTIFICATION_RETENTION_ADMIN_REQUIRED",
    );
  }
};

const auditRows = ({ actorId, candidates }) => {
  const counts = new Map();
  for (const candidate of candidates) {
    const clientId = String(candidate.clientId);
    counts.set(clientId, (counts.get(clientId) || 0) + 1);
  }
  return [...counts].map(([clientId, count]) => ({
    actorId,
    actorRole: "admin",
    action: "retention_delete_in_app_notification",
    targetType: "user",
    targetId: clientId,
    metadata: {
      policy: "today-in-app-notification-v1",
      count,
    },
  }));
};

export const runInAppNotificationRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_NOTIFICATION_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_NOTIFICATION_RETENTION_ACTOR_ID,
} = {}) => {
  if (enforce) assertEnforcement();
  const expired = await InAppNotification.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length > 0) {
    incrementMetric("notification.retention_candidates", candidates.length);
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
  let deleted = 0;
  try {
    await session.withTransaction(async () => {
      deletable = await excludeActiveCoachingClients(candidates, { session });
      const ids = deletable.map((notification) => notification._id);
      if (ids.length === 0) return;
      const result = await InAppNotification.deleteMany({
        _id: { $in: ids },
      }).session(session);
      deleted = result.deletedCount;
      await AuditLog.create(auditRows({ actorId, candidates: deletable }), {
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  if (deleted > 0) {
    incrementMetric("notification.retention_deletions", deleted);
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted,
  };
};
