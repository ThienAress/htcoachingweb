import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import CoachingComment from "../models/CoachingComment.js";
import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import InAppNotification from "../models/InAppNotification.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import { commentError } from "./coachingCommentAccess.service.js";
import { toCoachingCommentDto } from "./coachingCommentDto.service.js";
import { excludeActiveCoachingClients } from "./todayRetentionGuard.service.js";

const BATCH_SIZE = 100;
const TARGET_TYPES = new Set([
  "daily_journal",
  "weekly_checkin",
  "coaching_day",
  "workout_plan",
]);

const withSession = (query, session) =>
  session ? query.session(session) : query;

export const deleteCoachingCommentRecords = async ({
  commentIds,
  session = null,
}) => {
  const ids = [
    ...new Set(
      (commentIds || [])
        .filter((commentId) => mongoose.isValidObjectId(commentId))
        .map(String),
    ),
  ];
  if (ids.length === 0) {
    return { comments: 0, revisions: 0, notifications: 0 };
  }
  const revisions = await withSession(
    CoachingCommentRevision.deleteMany({ commentId: { $in: ids } }),
    session,
  );
  const notifications = await withSession(
    InAppNotification.deleteMany({
      targetType: "coaching_comment",
      targetId: { $in: ids },
    }),
    session,
  );
  const comments = await withSession(
    CoachingComment.deleteMany({ _id: { $in: ids } }),
    session,
  );
  return {
    comments: comments.deletedCount,
    revisions: revisions.deletedCount,
    notifications: notifications.deletedCount,
  };
};

export const deleteCoachingCommentsForTargets = async ({
  targets,
  session = null,
}) => {
  const targetFilters = (targets || [])
    .filter(
      ({ targetType, targetId }) =>
        TARGET_TYPES.has(targetType) &&
        mongoose.isValidObjectId(targetId),
    )
    .map(({ targetType, targetId }) => ({ targetType, targetId }));
  if (targetFilters.length === 0) {
    return { comments: 0, revisions: 0, notifications: 0 };
  }
  const comments = await withSession(
    CoachingComment.find({ $or: targetFilters }).select("_id").lean(),
    session,
  );
  return deleteCoachingCommentRecords({
    commentIds: comments.map((comment) => comment._id),
    session,
  });
};

export const exportCoachingCommentData = async ({ clientId }) => {
  const [comments, revisions] = await Promise.all([
    CoachingComment.find({ clientId }).sort({ createdAt: 1 }).lean(),
    CoachingCommentRevision.find({ clientId })
      .select("-payloadFingerprint -requestId")
      .sort({ changedAt: 1 })
      .lean(),
  ]);
  return {
    comments: comments.map((item) => toCoachingCommentDto(item, clientId)),
    revisions: revisions.map((item) => ({
      _id: item._id,
      commentId: item.commentId,
      revision: item.revision,
      actorRole: item.actorRole,
      action: item.action,
      beforeHash: item.beforeHash,
      afterHash: item.afterHash,
      changedAt: item.changedAt,
    })),
  };
};

export const deleteCoachingCommentData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let counts = { comments: 0, revisions: 0 };
  try {
    await session.withTransaction(async () => {
      const commentsToDelete = await CoachingComment.find({
        clientId: actor.id,
      })
        .select("_id")
        .session(session)
        .lean();
      await InAppNotification.deleteMany({
        targetType: "coaching_comment",
        targetId: {
          $in: commentsToDelete.map((comment) => comment._id),
        },
      }).session(session);
      const revisions = await CoachingCommentRevision.deleteMany({
        clientId: actor.id,
      }).session(session);
      const comments = await CoachingComment.deleteMany({
        clientId: actor.id,
      }).session(session);
      counts = {
        comments: comments.deletedCount,
        revisions: revisions.deletedCount,
      };
      await AuditLog.create(
        [{
          actorId: actor.id,
          actorRole: actor.role,
          action: "delete_coaching_comment_data",
          targetType: "user",
          targetId: actor.id,
          metadata: counts,
        }],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return counts;
};

const assertEnforcement = () => {
  if (process.env.TODAY_COMMENT_RETENTION_ENFORCE !== "true") {
    throw commentError(
      503,
      "Comment retention enforcement chưa được bật",
      "COMMENT_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
};

const assertAdmin = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw commentError(503, "Retention actor chưa cấu hình", "COMMENT_RETENTION_ACTOR_REQUIRED");
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" }).select("_id").lean();
  if (!actor) {
    throw commentError(403, "Retention actor phải là admin", "COMMENT_RETENTION_ADMIN_REQUIRED");
  }
};

export const runCoachingCommentRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_COMMENT_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_COMMENT_RETENTION_ACTOR_ID,
} = {}) => {
  if (enforce) assertEnforcement();
  const expired = await CoachingComment.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length) {
    incrementMetric("coaching_comment.retention_candidates", candidates.length);
  }
  if (!enforce) {
    return { dryRun: true, candidates: candidates.length, deleted: 0 };
  }
  await assertAdmin(actorId);
  if (!candidates.length) {
    return { dryRun: false, candidates: 0, deleted: 0 };
  }
  const session = await mongoose.startSession();
  let deletable = candidates;
  try {
    await session.withTransaction(async () => {
      deletable = await excludeActiveCoachingClients(candidates, { session });
      const ids = deletable.map((item) => item._id);
      if (!ids.length) return;
      await deleteCoachingCommentRecords({ commentIds: ids, session });
      await AuditLog.create(
        deletable.map((item) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_coaching_comment",
          targetType: "coaching_comment",
          targetId: item._id,
          metadata: { policy: "today-coaching-comment-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletable.length) {
    incrementMetric("coaching_comment.retention_deletions", deletable.length);
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletable.length,
  };
};
