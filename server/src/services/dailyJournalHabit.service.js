import mongoose from "mongoose";
import CoachingHabit from "../models/CoachingHabit.js";
import { habitError } from "./coachingHabitAccess.service.js";
import { isHabitScheduledForDate } from "./coachingHabitStreak.service.js";
import { journalError } from "./dailyJournalAccess.service.js";

export const normalizeHabitCompletions = (completions) => {
  if (!Array.isArray(completions) || completions.length > 20) {
    throw journalError(
      400,
      "habitCompletions có tối đa 20 phần tử",
      "INVALID_HABIT_COMPLETIONS",
    );
  }
  const normalized = completions.map((completion) => {
    if (
      !completion ||
      typeof completion !== "object" ||
      Array.isArray(completion) ||
      Object.keys(completion).some(
        (key) => !new Set(["habitId", "status"]).has(key),
      ) ||
      !mongoose.isValidObjectId(completion.habitId) ||
      !new Set(["completed", "skipped"]).has(completion.status)
    ) {
      throw journalError(
        400,
        "Habit completion không hợp lệ",
        "INVALID_HABIT_COMPLETIONS",
      );
    }
    return {
      habitId: String(completion.habitId),
      status: completion.status,
    };
  });
  if (
    new Set(normalized.map((completion) => completion.habitId)).size !==
    normalized.length
  ) {
    throw journalError(
      400,
      "habitId không được trùng trong ngày",
      "INVALID_HABIT_COMPLETIONS",
    );
  }
  return normalized;
};

export const canonicalizeHabitCompletions = async ({
  clientId,
  dateKey,
  journal,
  setFields,
  session,
  now,
}) => {
  const completions = setFields.habitCompletions;
  if (!completions) return setFields;
  const ids = completions.map((completion) => completion.habitId);
  let query = CoachingHabit.find({
    _id: { $in: ids },
    clientId,
  });
  if (session) query = query.session(session);
  const habits = await query;
  const habitById = new Map(
    habits.map((habit) => [String(habit._id), habit]),
  );
  if (habitById.size !== ids.length) {
    throw habitError(
      404,
      "Không tìm thấy habit",
      "COACHING_HABIT_NOT_FOUND",
    );
  }
  const existingById = new Map(
    (journal?.habitCompletions || []).map((completion) => [
      String(completion.habitId),
      completion,
    ]),
  );
  const canonical = completions.map((completion) => {
    const habit = habitById.get(completion.habitId);
    const existing = existingById.get(completion.habitId);
    if (
      !existing &&
      (!habit.isLatest ||
        habit.status !== "active" ||
        !isHabitScheduledForDate(habit, dateKey))
    ) {
      throw journalError(
        422,
        "Habit không active hoặc không được lên lịch cho ngày này",
        "HABIT_NOT_SCHEDULED",
      );
    }
    return {
      habitId: habit._id,
      lineageKey: habit.lineageKey,
      version: habit.version,
      titleSnapshot: existing?.titleSnapshot || habit.title,
      status: completion.status,
      recordedAt: existing?.recordedAt || now,
    };
  });
  return { ...setFields, habitCompletions: canonical };
};
