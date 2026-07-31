import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import CoachingHabit from "../models/CoachingHabit.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import { habitError } from "./coachingHabitAccess.service.js";
import { toCoachingHabitDto } from "./coachingHabitDto.service.js";
import {
  excludeActiveCoachingClients,
} from "./todayRetentionGuard.service.js";

const BATCH_SIZE = 100;

export const exportCoachingHabitData = async ({
  clientId,
  page = 1,
  limit = 50,
}) => {
  const [documents, total] = await Promise.all([
    CoachingHabit.find({ clientId })
      .sort({ createdAt: -1, version: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoachingHabit.countDocuments({ clientId }),
  ]);
  return {
    items: documents.map((habit) => toCoachingHabitDto(habit)),
    pagination: { page, limit, total },
  };
};

export const deleteCoachingHabitData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let habits = 0;
  try {
    await session.withTransaction(async () => {
      const deleted = await CoachingHabit.deleteMany({
        clientId: actor.id,
      }).session(session);
      habits = deleted.deletedCount;
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.role,
            action: "delete_coaching_habit_data",
            targetType: "user",
            targetId: actor.id,
            metadata: { habits },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return { habits };
};

const assertEnforcement = () => {
  if (process.env.TODAY_HABIT_RETENTION_ENFORCE !== "true") {
    throw habitError(
      503,
      "Coaching Habit retention enforcement chưa được bật",
      "COACHING_HABIT_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
};

const assertAdminActor = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw habitError(503, "Retention actor chưa cấu hình", "HABIT_RETENTION_ACTOR_REQUIRED");
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" })
    .select("_id")
    .lean();
  if (!actor) {
    throw habitError(403, "Retention actor phải là admin", "HABIT_RETENTION_ADMIN_REQUIRED");
  }
};

export const runCoachingHabitRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_HABIT_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_HABIT_RETENTION_ACTOR_ID,
} = {}) => {
  if (enforce) assertEnforcement();
  const expired = await CoachingHabit.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id clientId")
    .sort({ retentionExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length > 0) {
    incrementMetric("coaching_habit.retention_candidates", candidates.length);
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
      const ids = deletable.map((habit) => habit._id);
      if (ids.length === 0) return;
      await CoachingHabit.deleteMany({ _id: { $in: ids } }).session(session);
      await AuditLog.create(
        deletable.map((habit) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_coaching_habit",
          targetType: "coaching_habit",
          targetId: habit._id,
          metadata: { policy: "today-coaching-habit-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletable.length > 0) {
    incrementMetric("coaching_habit.retention_deletions", deletable.length);
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletable.length,
  };
};
