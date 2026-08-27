import { addDaysToDateKey, getAppDayOfWeek } from "../utils/dateKey.js";

export const isHabitWithinScheduleRange = (habit, dateKey) => {
  const schedule = habit.schedule;
  return (
    dateKey >= schedule.startDateKey &&
    (!schedule.endDateKey || dateKey <= schedule.endDateKey)
  );
};

export const isHabitScheduledForDate = (habit, dateKey) => {
  const schedule = habit.schedule;
  return (
    isHabitWithinScheduleRange(habit, dateKey) &&
    schedule.daysOfWeek.includes(getAppDayOfWeek(dateKey))
  );
};

export const deriveHabitStreak = ({ habit, journals, dateKey }) => {
  const completionByDate = new Map(
    journals.map((journal) => [
      journal.dateKey,
      (journal.habitCompletions || []).find(
        (completion) => completion.lineageKey === habit.lineageKey,
      ),
    ]),
  );
  let cursor = dateKey;
  let streak = 0;
  for (let offset = 0; offset <= 365; offset += 1) {
    if (cursor < habit.schedule.startDateKey) break;
    if (isHabitScheduledForDate(habit, cursor)) {
      const completion = completionByDate.get(cursor);
      if (completion?.status !== "completed") break;
      streak += 1;
    }
    cursor = addDaysToDateKey(cursor, -1);
  }
  return streak;
};
