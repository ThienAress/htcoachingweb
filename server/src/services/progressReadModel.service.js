import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";

const ALLOWED_DAYS = new Set([7, 30, 90]);
const WELLNESS_FIELDS = [
  "sleepHours",
  "waterMl",
  "steps",
  "energy",
  "hunger",
  "stress",
  "soreness",
  "pain",
];

export const createProgressRange = (
  days,
  now = new Date(),
  requestedEndDateKey = null,
) => {
  const normalizedDays = Number(days);
  if (!ALLOWED_DAYS.has(normalizedDays)) {
    throw new Error("Progress range chỉ hỗ trợ 7, 30 hoặc 90 ngày");
  }
  const endDateKey = requestedEndDateKey || getVietnamDateKey(now);
  parseDateKey(endDateKey);
  return {
    days: normalizedDays,
    startDateKey: addDaysToDateKey(endDateKey, -(normalizedDays - 1)),
    endDateKey,
  };
};

const inRange = (dateKey, start, end) =>
  dateKey >= start && dateKey <= end;
const percentMetric = (numerator, denominator) => ({
  numerator,
  denominator,
  percent:
    denominator === 0
      ? null
      : Number(((numerator / denominator) * 100).toFixed(1)),
});

const dueMetric = ({ items, range, completedStatus, eligibleStatuses }) => {
  const dueEnd = addDaysToDateKey(range.endDateKey, -1);
  const eligible = items.filter(
    (item) =>
      (inRange(item.dateKey, range.startDateKey, dueEnd) ||
        (item.dateKey === range.endDateKey &&
          item.status === completedStatus)) &&
      eligibleStatuses.includes(item.status),
  );
  return percentMetric(
    eligible.filter((item) => item.status === completedStatus).length,
    eligible.length,
  );
};

const mealCompliance = ({ journals, range }) => {
  const dueEnd = addDaysToDateKey(range.endDateKey, -1);
  let numerator = 0;
  let denominator = 0;
  for (const journal of journals) {
    if (!inRange(journal.dateKey, range.startDateKey, range.endDateKey)) {
      continue;
    }
    const planned = new Set(journal.plannedMealKeys || []);
    if (planned.size === 0) continue;
    const recordedKeys = new Set(
      (journal.nutritionEntries || [])
        .filter((entry) => planned.has(entry.plannedMealKey))
        .map((entry) => entry.plannedMealKey),
    );
    const dueKeys =
      journal.dateKey <= dueEnd ? planned : recordedKeys;
    denominator += dueKeys.size;
    const followed = new Set(
      (journal.nutritionEntries || [])
        .filter(
          (entry) =>
            entry.status === "eaten" &&
            dueKeys.has(entry.plannedMealKey),
        )
        .map((entry) => entry.plannedMealKey),
    );
    numerator += followed.size;
  }
  return percentMetric(numerator, denominator);
};

const dateKeys = (startDateKey, endDateKey) => {
  const result = [];
  for (
    let cursor = startDateKey;
    cursor <= endDateKey;
    cursor = addDaysToDateKey(cursor, 1)
  ) {
    result.push(cursor);
  }
  return result;
};

const effectiveHabit = (versions, dateKey) =>
  versions
    .filter((habit) => habit.effectiveDateKey <= dateKey)
    .sort((left, right) => right.version - left.version)[0] || null;

const isHabitDue = (habit, dateKey) =>
  habit.status === "active" &&
  dateKey >= habit.schedule.startDateKey &&
  (!habit.schedule.endDateKey || dateKey <= habit.schedule.endDateKey) &&
  habit.schedule.daysOfWeek.includes(getAppDayOfWeek(dateKey));

const habitCompliance = ({ habits, journals, range }) => {
  const byLineage = new Map();
  for (const habit of habits) {
    const versions = byLineage.get(habit.lineageKey) || [];
    versions.push(habit);
    byLineage.set(habit.lineageKey, versions);
  }
  const completionByDate = new Map(
    journals.map((journal) => [
      journal.dateKey,
      new Map(
        (journal.habitCompletions || []).map((item) => [
          item.lineageKey,
          item.status,
        ]),
      ),
    ]),
  );
  let numerator = 0;
  let denominator = 0;
  for (const dateKey of dateKeys(range.startDateKey, range.endDateKey)) {
    for (const [lineageKey, versions] of byLineage) {
      const habit = effectiveHabit(versions, dateKey);
      if (!habit || !isHabitDue(habit, dateKey)) continue;
      const completionStatus = completionByDate.get(dateKey)?.get(lineageKey);
      if (dateKey === range.endDateKey && !completionStatus) continue;
      denominator += 1;
      if (completionStatus === "completed") {
        numerator += 1;
      }
    }
  }
  return percentMetric(numerator, denominator);
};

const wellnessAverages = ({ journals, range }) =>
  Object.fromEntries(
    WELLNESS_FIELDS.map((field) => {
      const values = journals
        .filter((journal) =>
          inRange(journal.dateKey, range.startDateKey, range.endDateKey),
        )
        .map((journal) => journal.wellness?.[field])
        .filter((value) => typeof value === "number" && Number.isFinite(value));
      return [
        field,
        {
          average:
            values.length === 0
              ? null
              : Number(
                  (
                    values.reduce((sum, value) => sum + value, 0) /
                    values.length
                  ).toFixed(1),
                ),
          count: values.length,
        },
      ];
    }),
  );

const wellnessDaily = ({ journals, range }) =>
  journals
    .filter((journal) =>
      inRange(journal.dateKey, range.startDateKey, range.endDateKey),
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .map((journal) => ({
      dateKey: journal.dateKey,
      ...Object.fromEntries(
        WELLNESS_FIELDS.map((field) => [
          field,
          typeof journal.wellness?.[field] === "number"
            ? journal.wellness[field]
            : null,
        ]),
      ),
    }));

const weightTrend = ({ weeklyCheckins, range }) => {
  const lookbackStart = addDaysToDateKey(range.startDateKey, -14);
  const points = weeklyCheckins
    .filter(
      (item) =>
        item.status !== "draft" &&
        typeof item.weightKg === "number" &&
        inRange(item.weekStartDateKey, lookbackStart, range.endDateKey),
    )
    .sort((left, right) =>
      left.weekStartDateKey.localeCompare(right.weekStartDateKey),
    )
    .map((item) => ({
      weekStartDateKey: item.weekStartDateKey,
      weightKg: item.weightKg,
    }));
  return {
    points,
    changeKg:
      points.length < 2
        ? null
        : Number(
            (points.at(-1).weightKg - points[0].weightKg).toFixed(2),
          ),
  };
};

const bodyMetric = ({ weeklyCheckins, range, field, unit }) => {
  const series = weeklyCheckins
    .filter(
      (item) =>
        ["submitted", "reviewed"].includes(item.status) &&
        typeof item[field] === "number" &&
        Number.isFinite(item[field]) &&
        item[field] > 0 &&
        inRange(
          item.weekStartDateKey,
          range.startDateKey,
          range.endDateKey,
        ),
    )
    .sort((left, right) =>
      left.weekStartDateKey.localeCompare(right.weekStartDateKey),
    )
    .map((item) => ({
      dateKey: item.weekStartDateKey,
      value: item[field],
    }));
  return {
    unit,
    current: series.length === 0 ? null : series.at(-1),
    delta:
      series.length < 2
        ? null
        : Number((series.at(-1).value - series[0].value).toFixed(2)),
    series,
  };
};

const bodyProgress = ({ weeklyCheckins, range }) => ({
  source: {
    type: "weekly_checkin",
    includedStatuses: ["submitted", "reviewed"],
    dateField: "weekStartDateKey",
  },
  weightKg: bodyMetric({
    weeklyCheckins,
    range,
    field: "weightKg",
    unit: "kg",
  }),
  waistCm: bodyMetric({
    weeklyCheckins,
    range,
    field: "waistCm",
    unit: "cm",
  }),
});

export const buildProgressReadModel = ({
  range,
  schedules = [],
  workouts = [],
  coachingDays = [],
  journals = [],
  habits = [],
  weeklyCheckins = [],
}) => ({
  formulaVersion: "progress-v4",
  timeZone: "Asia/Ho_Chi_Minh",
  range,
  compliance: {
    scheduleAttendance: dueMetric({
      items: schedules,
      range,
      completedStatus: "completed",
      eligibleStatuses: ["scheduled", "completed"],
    }),
    workoutCompletion: dueMetric({
      items: workouts,
      range,
      completedStatus: "completed",
      eligibleStatuses: ["published", "completed"],
    }),
    coachingCompletion: dueMetric({
      items: coachingDays,
      range,
      completedStatus: "completed",
      eligibleStatuses: ["pending", "completed"],
    }),
    mealCompliance: mealCompliance({ journals, range }),
    habitCompliance: habitCompliance({ habits, journals, range }),
  },
  wellness: {
    ...wellnessAverages({ journals, range }),
    daily: wellnessDaily({ journals, range }),
  },
  weightTrend: weightTrend({ weeklyCheckins, range }),
  bodyProgress: bodyProgress({ weeklyCheckins, range }),
});
