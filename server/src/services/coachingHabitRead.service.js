import CoachingHabit from "../models/CoachingHabit.js";
import DailyJournal from "../models/DailyJournal.js";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKey.js";
import { assertTrainerManagesClient } from "./coachingHabitAccess.service.js";
import { toCoachingHabitDto } from "./coachingHabitDto.service.js";
import {
  deriveHabitStreak,
  isHabitScheduledForDate,
} from "./coachingHabitStreak.service.js";

const readJournals = (clientId, dateKey) =>
  DailyJournal.find({
    clientId,
    dateKey: {
      $gte: addDaysToDateKey(dateKey, -365),
      $lte: dateKey,
    },
  })
    .select("dateKey habitCompletions")
    .lean();

const withDerivedState = (habits, journals, dateKey) =>
  habits.map((habit) =>
    toCoachingHabitDto(habit, {
      scheduledToday: isHabitScheduledForDate(habit, dateKey),
      currentStreak:
        habit.status === "active"
          ? deriveHabitStreak({ habit, journals, dateKey })
          : 0,
      formulaVersion: "habit-streak-v1",
    }),
  );

export const listMyCoachingHabits = async ({ clientId, dateKey }) => {
  parseDateKey(dateKey);
  const [habits, journals] = await Promise.all([
    CoachingHabit.find({
      clientId,
      isLatest: true,
    })
      .sort({ createdAt: 1 })
      .lean(),
    readJournals(clientId, dateKey),
  ]);
  return {
    items: withDerivedState(habits, journals, dateKey),
    dateKey,
  };
};

export const listTrainerClientHabits = async ({
  trainerId,
  clientId,
  dateKey,
}) => {
  parseDateKey(dateKey);
  await assertTrainerManagesClient({ trainerId, clientId });
  const [habits, journals] = await Promise.all([
    CoachingHabit.find({
      clientId,
      isLatest: true,
      $or: [
        { createdByRole: "trainer", createdById: trainerId },
        { createdByRole: "user", visibility: "shared" },
      ],
    })
      .sort({ status: 1, createdAt: 1 })
      .lean(),
    readJournals(clientId, dateKey),
  ]);
  return {
    items: withDerivedState(habits, journals, dateKey),
    dateKey,
  };
};
