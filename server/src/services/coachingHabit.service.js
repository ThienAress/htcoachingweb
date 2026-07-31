import crypto from "node:crypto";
import mongoose from "mongoose";
import CoachingHabit from "../models/CoachingHabit.js";
import { getVietnamDateKey } from "../utils/dateKey.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertHabitWritesEnabled,
  assertCoachManagesClient,
  findHabitForMutation,
  habitError,
  resolveClientHabitAccess,
} from "./coachingHabitAccess.service.js";
import { toCoachingHabitDto } from "./coachingHabitDto.service.js";
import {
  assertHabitRequestId,
  habitFingerprint,
  normalizeHabitInput,
} from "./coachingHabitSnapshot.service.js";

const findReplay = async ({
  actorId,
  requestId,
  commandType,
  payloadFingerprint,
  session = null,
}) => {
  let query = CoachingHabit.findOne({
    commandActorId: actorId,
    commandRequestId: requestId,
  }).select("+commandActorId +commandType +commandRequestId +payloadFingerprint");
  if (session) query = query.session(session);
  const habit = await query;
  if (!habit) return null;
  if (
    habit.commandType !== commandType ||
    habit.payloadFingerprint !== payloadFingerprint
  ) {
    throw habitError(
      409,
      "requestId đã được dùng với thao tác hoặc dữ liệu khác",
      "REQUEST_ID_REUSED",
    );
  }
  incrementMetric("coaching_habit.idempotency_hits");
  return habit;
};

const duplicateResult = async ({ error, ...command }) => {
  if (error?.code !== 11000) throw error;
  const replay = await findReplay(command);
  if (replay) return replay;
  incrementMetric("coaching_habit.conflicts");
  throw habitError(
    409,
    "Habit đã thay đổi bởi yêu cầu khác",
    "COACHING_HABIT_CONFLICT",
  );
};

export const createCoachingHabit = async ({ actor, clientId, input }) => {
  assertHabitWritesEnabled();
  const createdByRole = actor.role === "user" ? "user" : "trainer";
  const ownerId = createdByRole === "trainer" ? clientId : actor.id;
  const normalized = normalizeHabitInput(input, {
    createdByRole,
    scheduleOverride:
      createdByRole === "trainer"
        ? {
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startDateKey: getVietnamDateKey(),
            endDateKey: null,
          }
        : null,
  });
  const payloadFingerprint = habitFingerprint({
    commandType: "create",
    ownerId: String(ownerId),
    normalized,
  });
  const command = {
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "create",
    payloadFingerprint,
  };
  const prior = await findReplay(command);
  if (prior) {
    return { data: toCoachingHabitDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({ ...command, session });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      let trainerIdAtCreation;
      if (createdByRole === "trainer") {
        const assignment = await assertCoachManagesClient({
          actor,
          clientId: ownerId,
          session,
        });
        trainerIdAtCreation = assignment.trainerId || actor.id;
      } else {
        const assignment = await resolveClientHabitAccess({
          clientId: actor.id,
          session,
        });
        trainerIdAtCreation = assignment.trainerId;
      }
      [result] = await CoachingHabit.create(
        [
          {
            clientId: ownerId,
            trainerIdAtCreation,
            createdById: actor.id,
            createdByRole,
            lineageKey: crypto.randomUUID(),
            version: 1,
            isLatest: true,
            status: "active",
            ...normalized,
            commandActorId: actor.id,
            commandType: "create",
            commandRequestId: input.requestId,
            payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await duplicateResult({ error, ...command });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("coaching_habit.creates");
  return { data: toCoachingHabitDto(result), idempotentReplay };
};

const normalizeUpdateInput = (input, { createdByRole, scheduleOverride }) => {
  if (!Number.isInteger(input?.expectedVersion) || input.expectedVersion < 1) {
    throw habitError(400, "expectedVersion không hợp lệ", "INVALID_HABIT_VERSION");
  }
  const { expectedVersion, ...definitionInput } = input;
  return {
    expectedVersion,
    definition: normalizeHabitInput(definitionInput, {
      createdByRole,
      scheduleOverride,
    }),
  };
};

export const updateCoachingHabit = async ({ actor, habitId, input }) => {
  assertHabitWritesEnabled();
  const baseline = await findHabitForMutation({ actor, habitId });
  const normalized = normalizeUpdateInput(input, {
    createdByRole: baseline.createdByRole,
    scheduleOverride:
      baseline.createdByRole === "trainer"
        ? {
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startDateKey: baseline.schedule.startDateKey,
            endDateKey: null,
          }
        : null,
  });
  const payloadFingerprint = habitFingerprint({
    commandType: "update",
    habitId,
    normalized,
  });
  const command = {
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "update",
    payloadFingerprint,
  };
  const prior = await findReplay(command);
  if (prior) {
    return { data: toCoachingHabitDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({ ...command, session });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      const current = await findHabitForMutation({ actor, habitId, session });
      if (
        !current.isLatest ||
        current.version !== normalized.expectedVersion ||
        current.status === "archived"
      ) {
        incrementMetric("coaching_habit.conflicts");
        throw habitError(
          409,
          "Thói quen đã có bản cập nhật mới hơn",
          "COACHING_HABIT_VERSION_CONFLICT",
        );
      }
      current.isLatest = false;
      await current.save({ session });
      [result] = await CoachingHabit.create(
        [
          {
            clientId: current.clientId,
            trainerIdAtCreation: current.trainerIdAtCreation,
            createdById: current.createdById,
            createdByRole: current.createdByRole,
            lineageKey: current.lineageKey,
            version: current.version + 1,
            isLatest: true,
            status: "active",
            ...normalized.definition,
            retentionExpiresAt: current.retentionExpiresAt,
            commandActorId: actor.id,
            commandType: "update",
            commandRequestId: input.requestId,
            payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await duplicateResult({ error, ...command });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("coaching_habit.updates");
  return { data: toCoachingHabitDto(result), idempotentReplay };
};

const assertStatusInput = (input) => {
  assertHabitRequestId(input?.requestId);
  if (!Number.isInteger(input?.expectedVersion) || input.expectedVersion < 1) {
    throw habitError(400, "expectedVersion không hợp lệ", "INVALID_HABIT_VERSION");
  }
  if (!new Set(["active", "paused", "archived"]).has(input?.status)) {
    throw habitError(400, "status không hợp lệ", "INVALID_HABIT_STATUS");
  }
};

export const changeCoachingHabitStatus = async ({ actor, habitId, input }) => {
  assertHabitWritesEnabled();
  assertStatusInput(input);
  const payloadFingerprint = habitFingerprint({
    commandType: "status",
    habitId,
    status: input.status,
    expectedVersion: input.expectedVersion,
  });
  const command = {
    actorId: actor.id,
    requestId: input.requestId,
    commandType: "status",
    payloadFingerprint,
  };
  const prior = await findReplay(command);
  if (prior) {
    return { data: toCoachingHabitDto(prior), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let result;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findReplay({ ...command, session });
      if (replay) {
        result = replay;
        idempotentReplay = true;
        return;
      }
      const current = await findHabitForMutation({ actor, habitId, session });
      if (
        !current.isLatest ||
        current.version !== input.expectedVersion ||
        current.status === input.status ||
        current.status === "archived"
      ) {
        incrementMetric("coaching_habit.conflicts");
        throw habitError(
          409,
          "Habit đã có phiên bản mới hơn hoặc transition không hợp lệ",
          "COACHING_HABIT_VERSION_CONFLICT",
        );
      }
      current.isLatest = false;
      await current.save({ session });
      [result] = await CoachingHabit.create(
        [
          {
            clientId: current.clientId,
            trainerIdAtCreation: current.trainerIdAtCreation,
            createdById: current.createdById,
            createdByRole: current.createdByRole,
            lineageKey: current.lineageKey,
            version: current.version + 1,
            isLatest: true,
            status: input.status,
            title: current.title,
            description: current.description,
            category: current.category,
            schedule: current.schedule.toObject(),
            target: current.target,
            unit: current.unit,
            visibility: current.visibility,
            retentionExpiresAt: current.retentionExpiresAt,
            commandActorId: actor.id,
            commandType: "status",
            commandRequestId: input.requestId,
            payloadFingerprint,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    result = await duplicateResult({ error, ...command });
    idempotentReplay = true;
  } finally {
    await session.endSession();
  }
  if (!idempotentReplay) incrementMetric("coaching_habit.status_changes");
  return { data: toCoachingHabitDto(result), idempotentReplay };
};
