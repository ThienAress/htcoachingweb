import crypto from "node:crypto";
import mongoose from "mongoose";
import SavedMealPlan from "../models/SavedMealPlan.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertSavedMealPlanWritesEnabled,
  findOwnedSavedMealPlan,
  resolveSavedMealPlanTrainerMetadata,
  savedMealPlanError,
} from "./savedMealPlanAccess.service.js";
import { toSavedMealPlanDto } from "./savedMealPlanDto.service.js";
import {
  buildCanonicalSavedMealPlan,
  savedMealPlanFingerprint,
} from "./savedMealPlanSnapshot.service.js";
import { normalizeSavedMealPlanTitle } from "./savedMealPlanTitlePolicy.service.js";
import {
  assertSavedMealPlanExpectedVersion,
  assertSavedMealPlanRequestId,
  findSavedMealPlanCommandReplay,
  handleSavedMealPlanDuplicateCommand,
  prepareSavedMealPlanContentCommand,
} from "./savedMealPlanCommand.service.js";

export const createSavedMealPlan = async ({ actor, input }) => {
  assertSavedMealPlanWritesEnabled();
  const prepared = prepareSavedMealPlanContentCommand({
    input,
    commandType: "create",
  });
  const prior = await findSavedMealPlanCommandReplay({
    ownerId: actor.id,
    commandType: "create",
    ...prepared,
  });
  if (prior) {
    return { data: toSavedMealPlanDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findSavedMealPlanCommandReplay({
        ownerId: actor.id,
        commandType: "create",
        session,
        ...prepared,
      });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      const assignment = await resolveSavedMealPlanTrainerMetadata({
        ownerId: actor.id,
        session,
      });
      const snapshot = await buildCanonicalSavedMealPlan({
        normalized: prepared.normalized,
        session,
      });
      [result] = await SavedMealPlan.create(
        [
          {
            ownerId: actor.id,
            trainerIdAtCreation: assignment.trainerId,
            lineageKey: crypto.randomUUID(),
            version: 1,
            isLatest: true,
            status: "active",
            ...snapshot,
            commandType: "create",
            createdByRequestId: prepared.requestId,
            payloadFingerprint: prepared.payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await handleSavedMealPlanDuplicateCommand({
      error,
      ownerId: actor.id,
      commandType: "create",
      ...prepared,
    });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("saved_meal_plan.saves");
  return { data: toSavedMealPlanDto(result), idempotentReplay };
};

export const reviseSavedMealPlan = async ({ actor, planId, input }) => {
  assertSavedMealPlanWritesEnabled();
  assertSavedMealPlanExpectedVersion(input?.expectedVersion);
  const prepared = prepareSavedMealPlanContentCommand({
    input,
    commandType: "revise",
    planId,
  });
  const prior = await findSavedMealPlanCommandReplay({
    ownerId: actor.id,
    commandType: "revise",
    ...prepared,
  });
  if (prior) {
    return { data: toSavedMealPlanDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findSavedMealPlanCommandReplay({
        ownerId: actor.id,
        commandType: "revise",
        session,
        ...prepared,
      });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      const assignment = await resolveSavedMealPlanTrainerMetadata({
        ownerId: actor.id,
        session,
      });
      const current = await findOwnedSavedMealPlan({
        ownerId: actor.id,
        planId,
        session,
      });
      if (
        !current.isLatest ||
        current.status !== "active" ||
        current.version !== input.expectedVersion
      ) {
        incrementMetric("saved_meal_plan.conflicts");
        throw savedMealPlanError(
          409,
          "Thực đơn đã thay đổi hoặc không còn hoạt động",
          "SAVED_MEAL_PLAN_VERSION_CONFLICT",
        );
      }
      const snapshot = await buildCanonicalSavedMealPlan({
        normalized: prepared.normalized,
        session,
      });
      current.isLatest = false;
      current.status = "superseded";
      await current.save({ session });
      [result] = await SavedMealPlan.create(
        [
          {
            ownerId: actor.id,
            trainerIdAtCreation: assignment.trainerId,
            lineageKey: current.lineageKey,
            version: current.version + 1,
            isLatest: true,
            status: "active",
            ...snapshot,
            commandType: "revise",
            createdByRequestId: prepared.requestId,
            payloadFingerprint: prepared.payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await handleSavedMealPlanDuplicateCommand({
      error,
      ownerId: actor.id,
      commandType: "revise",
      ...prepared,
    });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("saved_meal_plan.saves");
  return { data: toSavedMealPlanDto(result), idempotentReplay };
};

export const renameSavedMealPlan = async ({ actor, planId, input }) => {
  assertSavedMealPlanWritesEnabled();
  assertSavedMealPlanRequestId(input?.requestId);
  assertSavedMealPlanExpectedVersion(input?.expectedVersion);
  const title = normalizeSavedMealPlanTitle(input?.title);
  const prepared = {
    requestId: input.requestId,
    payloadFingerprint: savedMealPlanFingerprint({
      commandType: "rename",
      planId,
      expectedVersion: input.expectedVersion,
      title,
    }),
  };
  const prior = await findSavedMealPlanCommandReplay({
    ownerId: actor.id,
    commandType: "rename",
    ...prepared,
  });
  if (prior) {
    return { data: toSavedMealPlanDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findSavedMealPlanCommandReplay({
        ownerId: actor.id,
        commandType: "rename",
        session,
        ...prepared,
      });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      const current = await findOwnedSavedMealPlan({
        ownerId: actor.id,
        planId,
        session,
      });
      if (
        !current.isLatest ||
        current.status !== "active" ||
        current.version !== input.expectedVersion
      ) {
        incrementMetric("saved_meal_plan.conflicts");
        throw savedMealPlanError(
          409,
          "Thực đơn đã thay đổi hoặc không còn hoạt động",
          "SAVED_MEAL_PLAN_VERSION_CONFLICT",
        );
      }
      const snapshot = current.toObject();
      current.isLatest = false;
      current.status = "superseded";
      await current.save({ session });
      [result] = await SavedMealPlan.create(
        [
          {
            ownerId: actor.id,
            trainerIdAtCreation: current.trainerIdAtCreation,
            lineageKey: current.lineageKey,
            version: current.version + 1,
            isLatest: true,
            status: "active",
            title,
            source: current.source,
            target: snapshot.target || null,
            meals: snapshot.meals,
            totals: snapshot.totals,
            commandType: "rename",
            createdByRequestId: prepared.requestId,
            payloadFingerprint: prepared.payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await handleSavedMealPlanDuplicateCommand({
      error,
      ownerId: actor.id,
      commandType: "rename",
      ...prepared,
    });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("saved_meal_plan.saves");
  return { data: toSavedMealPlanDto(result), idempotentReplay };
};

export const archiveSavedMealPlan = async ({ actor, planId, input }) => {
  assertSavedMealPlanWritesEnabled();
  assertSavedMealPlanRequestId(input?.requestId);
  assertSavedMealPlanExpectedVersion(input?.expectedVersion);
  const fingerprint = savedMealPlanFingerprint({
    commandType: "archive",
    planId,
    expectedVersion: input.expectedVersion,
  });
  const replay = await SavedMealPlan.findOne({
    ownerId: actor.id,
    archiveRequestId: input.requestId,
  }).select("+archiveRequestId +archiveFingerprint");
  if (replay) {
    if (replay.archiveFingerprint !== fingerprint) {
      throw savedMealPlanError(
        409,
        "requestId đã được dùng với dữ liệu khác",
        "REQUEST_ID_REUSED",
      );
    }
    incrementMetric("saved_meal_plan.idempotency_hits");
    return { data: toSavedMealPlanDto(replay), idempotentReplay: true };
  }
  const archived = await SavedMealPlan.findOneAndUpdate(
    {
      _id: planId,
      ownerId: actor.id,
      isLatest: true,
      status: "active",
      version: input.expectedVersion,
    },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
        archiveRequestId: input.requestId,
        archiveFingerprint: fingerprint,
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!archived) {
    await findOwnedSavedMealPlan({ ownerId: actor.id, planId });
    incrementMetric("saved_meal_plan.conflicts");
    throw savedMealPlanError(
      409,
      "Thực đơn đã thay đổi hoặc đã được bỏ lưu",
      "SAVED_MEAL_PLAN_VERSION_CONFLICT",
    );
  }
  return { data: toSavedMealPlanDto(archived), idempotentReplay: false };
};

export const getOwnedSavedMealPlan = async ({ ownerId, planId }) =>
  toSavedMealPlanDto(
    await findOwnedSavedMealPlan({ ownerId, planId }),
  );

export const listOwnedSavedMealPlans = async ({
  ownerId,
  status = "active",
  page = 1,
  limit = 20,
}) => {
  const filter = {
    ownerId,
    isLatest: true,
    ...(status === "all" ? {} : { status }),
  };
  const [documents, total] = await Promise.all([
    SavedMealPlan.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SavedMealPlan.countDocuments(filter),
  ]);
  return {
    items: documents.map(toSavedMealPlanDto),
    total,
    page,
    limit,
  };
};
