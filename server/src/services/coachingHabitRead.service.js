import CoachingHabit from "../models/CoachingHabit.js";
import DailyJournal from "../models/DailyJournal.js";
import Order from "../models/Order.js";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKey.js";
import { assertCoachManagesClient } from "./coachingHabitAccess.service.js";
import { toCoachingHabitDto } from "./coachingHabitDto.service.js";
import {
  deriveHabitStreak,
  isHabitScheduledForDate,
  isHabitWithinScheduleRange,
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
      withinScheduleRange: isHabitWithinScheduleRange(habit, dateKey),
      currentStreak:
        habit.status === "active"
          ? deriveHabitStreak({ habit, journals, dateKey })
          : 0,
      formulaVersion: "habit-streak-v1",
    }),
  );

export const listMyCoachingHabits = async ({ clientId, dateKey }) => {
  parseDateKey(dateKey);
  const [activeOrder, journals] = await Promise.all([
    Order.exists({
      userId: clientId,
      status: "approved",
      sessions: { $gt: 0 },
    }),
    readJournals(clientId, dateKey),
  ]);
  const habits = await CoachingHabit.find({
    clientId,
    isLatest: true,
    ...(activeOrder ? {} : { createdByRole: "user" }),
  })
    .sort({ createdAt: 1 })
    .lean();
  return {
    items: withDerivedState(habits, journals, dateKey),
    dateKey,
  };
};

export const listTrainerClientHabits = async ({
  actor,
  clientId,
  dateKey,
}) => {
  parseDateKey(dateKey);
  await assertCoachManagesClient({ actor, clientId });
  const coachCreatedFilter =
    actor.role === "admin"
      ? { createdByRole: "trainer" }
      : { createdByRole: "trainer", createdById: actor.id };
  const [habits, journals] = await Promise.all([
    CoachingHabit.find({
      clientId,
      isLatest: true,
      $or: [
        coachCreatedFilter,
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
