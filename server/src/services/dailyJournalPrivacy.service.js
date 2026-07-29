import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  toDailyJournalDto,
  toDailyJournalRevisionDto,
} from "./dailyJournalDto.service.js";
import { journalError } from "./dailyJournalAccess.service.js";
import {
  excludeActiveCoachingClients,
} from "./todayRetentionGuard.service.js";
import {
  deleteCoachingCommentsForTargets,
} from "./coachingCommentPrivacy.service.js";

const RETENTION_BATCH_SIZE = 100;

export const exportDailyJournalData = async ({
  clientId,
  page = 1,
  limit = 50,
}) => {
  const filter = { clientId };
  const [journals, total] = await Promise.all([
    DailyJournal.find(filter)
      .sort({ dateKey: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DailyJournal.countDocuments(filter),
  ]);
  const journalIds = journals.map((journal) => journal._id);
  const revisions = await DailyJournalRevision.find({
    clientId,
    journalId: { $in: journalIds },
  })
    .select("-payloadFingerprint -requestId")
    .sort({ changedAt: 1 })
    .lean();
  return {
    journals: journals.map(toDailyJournalDto),
    revisions: revisions.map(toDailyJournalRevisionDto),
    pagination: { page, limit, total },
  };
};

export const deleteDailyJournalData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let counts = { journals: 0, revisions: 0 };
  try {
    await session.withTransaction(async () => {
      const journals = await DailyJournal.find({ clientId: actor.id })
        .select("_id")
        .session(session);
      const journalIds = journals.map((journal) => journal._id);
      await deleteCoachingCommentsForTargets({
        targets: journalIds.map((targetId) => ({
          targetType: "daily_journal",
          targetId,
        })),
        session,
      });
      const revisions = await DailyJournalRevision.deleteMany({
        clientId: actor.id,
      }).session(session);
      const deleted = await DailyJournal.deleteMany({
        clientId: actor.id,
        _id: { $in: journalIds },
      }).session(session);
      counts = {
        journals: deleted.deletedCount,
        revisions: revisions.deletedCount,
      };
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.role === "admin" ? "admin" : "user",
            action: "delete_daily_journal_data",
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

export const runDailyJournalRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_JOURNAL_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_JOURNAL_RETENTION_ACTOR_ID,
} = {}) => {
  if (
    enforce &&
    process.env.TODAY_JOURNAL_RETENTION_ENFORCE !== "true"
  ) {
    throw journalError(
      503,
      "Daily Journal retention enforcement chưa được bật",
      "JOURNAL_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
  const expiredCandidates = await DailyJournal.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(RETENTION_BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(
    expiredCandidates,
  );
  if (candidates.length > 0) {
    incrementMetric("daily_journal.retention_candidates", candidates.length);
  }
  if (!enforce) {
    return {
      dryRun: true,
      candidates: candidates.length,
      deleted: 0,
    };
  }
  if (!mongoose.isValidObjectId(actorId)) {
    throw journalError(
      503,
      "Retention actor chưa được cấu hình",
      "JOURNAL_RETENTION_ACTOR_REQUIRED",
    );
  }
  const retentionActor = await User.findOne({
    _id: actorId,
    role: "admin",
  })
    .select("_id")
    .lean();
  if (!retentionActor) {
    throw journalError(
      403,
      "Retention actor phải là admin",
      "JOURNAL_RETENTION_ADMIN_REQUIRED",
    );
  }
  if (candidates.length === 0) {
    return { dryRun: false, candidates: 0, deleted: 0 };
  }
  const session = await mongoose.startSession();
  let deletableCandidates = candidates;
  try {
    await session.withTransaction(async () => {
      deletableCandidates = await excludeActiveCoachingClients(
        candidates,
        { session },
      );
      const journalIds = deletableCandidates.map(
        (journal) => journal._id,
      );
      if (journalIds.length === 0) return;
      await deleteCoachingCommentsForTargets({
        targets: journalIds.map((targetId) => ({
          targetType: "daily_journal",
          targetId,
        })),
        session,
      });
      await DailyJournalRevision.deleteMany({
        journalId: { $in: journalIds },
      }).session(session);
      await DailyJournal.deleteMany({
        _id: { $in: journalIds },
      }).session(session);
      await AuditLog.create(
        deletableCandidates.map((journal) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_daily_journal",
          targetType: "daily_journal",
          targetId: journal._id,
          metadata: { policy: "today-journal-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletableCandidates.length > 0) {
    incrementMetric(
      "daily_journal.retention_deletions",
      deletableCandidates.length,
    );
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletableCandidates.length,
  };
};
