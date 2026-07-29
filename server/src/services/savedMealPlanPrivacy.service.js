import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import SavedMealPlan from "../models/SavedMealPlan.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import { savedMealPlanError } from "./savedMealPlanAccess.service.js";
import { toSavedMealPlanDto } from "./savedMealPlanDto.service.js";
import {
  excludeActiveCoachingClients,
} from "./todayRetentionGuard.service.js";

const RETENTION_BATCH_SIZE = 100;

export const exportSavedMealPlanData = async ({
  ownerId,
  page = 1,
  limit = 50,
}) => {
  const filter = { ownerId };
  const [documents, total] = await Promise.all([
    SavedMealPlan.find(filter)
      .sort({ updatedAt: -1, version: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SavedMealPlan.countDocuments(filter),
  ]);
  return {
    items: documents.map(toSavedMealPlanDto),
    pagination: { page, limit, total },
  };
};

export const deleteSavedMealPlanData = async ({ actor }) => {
  const session = await mongoose.startSession();
  let plans = 0;
  try {
    await session.withTransaction(async () => {
      const deleted = await SavedMealPlan.deleteMany({
        ownerId: actor.id,
      }).session(session);
      plans = deleted.deletedCount;
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.role,
            action: "delete_saved_meal_plan_data",
            targetType: "user",
            targetId: actor.id,
            metadata: { plans },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return { plans };
};

const assertRetentionEnforcement = () => {
  if (process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE !== "true") {
    throw savedMealPlanError(
      503,
      "Saved Meal Plan retention enforcement chưa được bật",
      "SAVED_MEAL_PLAN_RETENTION_ENFORCEMENT_DISABLED",
    );
  }
};

const resolveRetentionActor = async (actorId) => {
  if (!mongoose.isValidObjectId(actorId)) {
    throw savedMealPlanError(
      503,
      "Retention actor chưa được cấu hình",
      "SAVED_MEAL_PLAN_RETENTION_ACTOR_REQUIRED",
    );
  }
  const actor = await User.findOne({ _id: actorId, role: "admin" })
    .select("_id")
    .lean();
  if (!actor) {
    throw savedMealPlanError(
      403,
      "Retention actor phải là admin",
      "SAVED_MEAL_PLAN_RETENTION_ADMIN_REQUIRED",
    );
  }
};

export const runSavedMealPlanRetentionSweep = async ({
  now = new Date(),
  enforce = process.env.TODAY_MEAL_PLAN_RETENTION_ENFORCE === "true",
  actorId = process.env.TODAY_MEAL_PLAN_RETENTION_ACTOR_ID,
} = {}) => {
  if (enforce) assertRetentionEnforcement();
  const expired = await SavedMealPlan.find({
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .select("_id ownerId")
    .sort({ retentionExpiresAt: 1 })
    .limit(RETENTION_BATCH_SIZE)
    .lean();
  const candidates = await excludeActiveCoachingClients(expired);
  if (candidates.length > 0) {
    incrementMetric(
      "saved_meal_plan.retention_candidates",
      candidates.length,
    );
  }
  if (!enforce) {
    return { dryRun: true, candidates: candidates.length, deleted: 0 };
  }
  await resolveRetentionActor(actorId);
  if (candidates.length === 0) {
    return { dryRun: false, candidates: 0, deleted: 0 };
  }

  const session = await mongoose.startSession();
  let deletable = candidates;
  try {
    await session.withTransaction(async () => {
      deletable = await excludeActiveCoachingClients(candidates, {
        session,
      });
      const ids = deletable.map((plan) => plan._id);
      if (ids.length === 0) return;
      await SavedMealPlan.deleteMany({ _id: { $in: ids } }).session(
        session,
      );
      await AuditLog.create(
        deletable.map((plan) => ({
          actorId,
          actorRole: "admin",
          action: "retention_delete_saved_meal_plan",
          targetType: "saved_meal_plan",
          targetId: plan._id,
          metadata: { policy: "today-saved-meal-plan-v1" },
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (deletable.length > 0) {
    incrementMetric(
      "saved_meal_plan.retention_deletions",
      deletable.length,
    );
  }
  return {
    dryRun: false,
    candidates: candidates.length,
    deleted: deletable.length,
  };
};
