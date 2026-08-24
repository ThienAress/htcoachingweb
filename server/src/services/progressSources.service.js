import CoachingDay from "../models/CoachingDay.js";
import CoachingHabit from "../models/CoachingHabit.js";
import DailyJournal from "../models/DailyJournal.js";
import SavedMealPlan from "../models/SavedMealPlan.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import {
  addDaysToDateKey,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../utils/dateKey.js";

const MAX_PROGRESS_ACTIVITY_DOCUMENTS = 400;
const MAX_PROGRESS_DAILY_DOCUMENTS = 200;
const MAX_PROGRESS_WEEKLY_CHECKINS = 40;

const utcBounds = (range) => ({
  start: getVietnamDayRangeUtc(range.startDateKey).start,
  end: getVietnamDayRangeUtc(range.endDateKey).end,
});
const objectId = (value) => (value ? String(value) : "");

const loadSchedules = async (clientId, range, bounds) => {
  const documents = await TrainingSchedule.find({
    clientId,
    $or: [
      {
        occurrenceDateKey: {
          $gte: range.startDateKey,
          $lte: range.endDateKey,
        },
      },
      {
        occurrenceDateKey: { $in: [null, ""] },
        startAt: { $gte: bounds.start, $lt: bounds.end },
      },
    ],
  })
    .select("occurrenceDateKey startAt status")
    .limit(MAX_PROGRESS_ACTIVITY_DOCUMENTS)
    .lean();
  return documents.map((item) => ({
    dateKey: item.occurrenceDateKey || getVietnamDateKey(item.startAt),
    status: item.status,
  }));
};

const loadWorkouts = async (clientId, email, bounds) => {
  const ownership = [{ clientId }];
  if (email) ownership.push({ clientId: null, clientEmail: email });
  const documents = await WorkoutPlan.find({
    $or: ownership,
    planDate: { $gte: bounds.start, $lt: bounds.end },
    status: { $in: ["published", "completed"] },
  })
    .select("planDate status")
    .limit(MAX_PROGRESS_ACTIVITY_DOCUMENTS)
    .lean();
  return documents.map((item) => ({
    dateKey: getVietnamDateKey(item.planDate),
    status: item.status,
  }));
};

const loadCoachingDays = async (clientId, range) => {
  const documents = await CoachingDay.find({
    userId: clientId,
    dateString: { $gte: range.startDateKey, $lte: range.endDateKey },
  })
    .select("dateString clientStatus")
    .limit(MAX_PROGRESS_DAILY_DOCUMENTS)
    .lean();
  return documents.map((item) => ({
    dateKey: item.dateString,
    status: item.clientStatus,
  }));
};

const loadJournals = async (clientId, range) => {
  const documents = await DailyJournal.find({
    clientId,
    status: "submitted",
    dateKey: { $gte: range.startDateKey, $lte: range.endDateKey },
  })
    .select("dateKey wellness nutrition habitCompletions")
    .limit(MAX_PROGRESS_DAILY_DOCUMENTS)
    .lean();
  const planIds = [
    ...new Set(
      documents
        .map((item) => objectId(item.nutrition?.assignment?.savedMealPlanId))
        .filter(Boolean),
    ),
  ];
  const plans = await SavedMealPlan.find({
    _id: { $in: planIds },
    ownerId: clientId,
  })
    .select("_id version meals.key")
    .lean();
  const planById = new Map(plans.map((plan) => [objectId(plan._id), plan]));
  return documents.map((item) => {
    const assignment = item.nutrition?.assignment;
    const plan = planById.get(objectId(assignment?.savedMealPlanId));
    const exactPlan =
      plan && assignment?.version === plan.version ? plan : null;
    return {
      dateKey: item.dateKey,
      wellness: item.wellness || {},
      plannedMealKeys: exactPlan
        ? exactPlan.meals.map((meal) => meal.key)
        : [],
      nutritionEntries: (item.nutrition?.entries || [])
        .filter(
          (entry) =>
            exactPlan &&
            entry.mode === "follow_plan" &&
            objectId(entry.savedMealPlanId) === objectId(exactPlan._id) &&
            entry.version === exactPlan.version,
        )
        .map((entry) => ({
          plannedMealKey: entry.plannedMealKey,
          status: entry.status,
        })),
      habitCompletions: (item.habitCompletions || []).map((completion) => ({
        lineageKey: completion.lineageKey,
        status: completion.status,
      })),
    };
  });
};

const loadHabits = async (clientId, range, bounds, trainerId = null) => {
  const filter = {
    clientId,
    createdAt: { $lt: bounds.end },
    "schedule.startDateKey": { $lte: range.endDateKey },
  };
  if (trainerId) {
    filter.$or = [
      { createdByRole: "trainer", createdById: trainerId },
      { createdByRole: "user", visibility: "shared" },
    ];
  }
  const documents = await CoachingHabit.find(filter)
    .select("lineageKey version status schedule createdAt")
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  return documents.map((habit) => ({
    lineageKey: habit.lineageKey,
    version: habit.version,
    status: habit.status,
    effectiveDateKey: getVietnamDateKey(habit.createdAt),
    schedule: habit.schedule,
  }));
};

const loadWeeklyCheckins = async (clientId, range) => {
  const documents = await WeeklyCheckin.find({
    clientId,
    weekStartDateKey: {
      $gte: addDaysToDateKey(range.startDateKey, -14),
      $lte: range.endDateKey,
    },
    status: { $in: ["submitted", "reviewed"] },
    $or: [
      { "body.weightKg": { $type: "number" } },
      { "body.waistCm": { $type: "number" } },
      { "body.bodyFatPercent": { $type: "number" } },
      { "body.skeletalMusclePercent": { $type: "number" } },
    ],
  })
    .select(
      "weekStartDateKey status body.weightKg body.waistCm body.bodyFatPercent body.skeletalMusclePercent",
    )
    .sort({ weekStartDateKey: 1 })
    .limit(MAX_PROGRESS_WEEKLY_CHECKINS)
    .lean();
  return documents.map((item) => ({
    weekStartDateKey: item.weekStartDateKey,
    status: item.status,
    weightKg: item.body?.weightKg,
    waistCm: item.body?.waistCm,
    bodyFatPercent: item.body?.bodyFatPercent,
    skeletalMusclePercent: item.body?.skeletalMusclePercent,
  }));
};

export const loadProgressSources = async ({
  clientId,
  email,
  range,
  trainerId = null,
}) => {
  const bounds = utcBounds(range);
  const [
    schedules,
    workouts,
    coachingDays,
    journals,
    habits,
    weeklyCheckins,
  ] = await Promise.all([
    loadSchedules(clientId, range, bounds),
    loadWorkouts(clientId, email, bounds),
    loadCoachingDays(clientId, range),
    loadJournals(clientId, range),
    loadHabits(clientId, range, bounds, trainerId),
    loadWeeklyCheckins(clientId, range),
  ]);
  return {
    schedules,
    workouts,
    coachingDays,
    journals,
    habits,
    weeklyCheckins,
  };
};
