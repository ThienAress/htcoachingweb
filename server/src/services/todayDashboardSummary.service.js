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

const RECORDED_MEAL_STATUSES = new Set(["eaten", "changed", "skipped"]);

const createModuleProgress = (completed, total) => {
  if (total === 0) {
    return {
      completed: 0,
      total: 0,
      percent: null,
      state: "not_applicable",
    };
  }

  const safeCompleted = Math.min(total, Math.max(0, completed));
  const percent = Math.round((safeCompleted / total) * 100);
  return {
    completed: safeCompleted,
    total,
    percent,
    state:
      percent === 100
        ? "completed"
        : percent === 0
          ? "not_started"
          : "in_progress",
  };
};

const calculateTrainingProgress = (sections) => {
  const schedules =
    sections.schedule?.status === "ready" ? sections.schedule.items || [] : [];
  const exercises =
    sections.coaching?.status === "ready"
      ? sections.coaching.day?.exercises || []
      : [];
  const workouts =
    sections.workout?.status === "ready" ? sections.workout.items || [] : [];

  return createModuleProgress(
    schedules.filter((item) => item.status === "completed").length +
      exercises.filter((item) => item.completed).length +
      workouts.filter((item) => item.status === "completed").length,
    schedules.length + exercises.length + workouts.length,
  );
};

const calculateNutritionProgress = (sections) => {
  const journal =
    sections.journal?.status === "ready" ? sections.journal.day : null;
  const nutrition = journal?.nutrition;
  const assignment = nutrition?.assignment;
  const plannedMealKeys = Array.isArray(nutrition?.plannedMealKeys)
    ? nutrition.plannedMealKeys
    : [];
  if (!assignment || plannedMealKeys.length === 0) {
    return createModuleProgress(0, 0);
  }

  const dueKeys = new Set(plannedMealKeys);
  const recordedKeys = new Set(
    (nutrition.entries || [])
      .filter(
        (entry) =>
          entry.mode === "follow_plan" &&
          RECORDED_MEAL_STATUSES.has(entry.status) &&
          dueKeys.has(entry.plannedMealKey) &&
          String(entry.savedMealPlanId) === String(assignment.savedMealPlanId) &&
          entry.version === assignment.version,
      )
      .map((entry) => entry.plannedMealKey),
  );

  return createModuleProgress(recordedKeys.size, dueKeys.size);
};

const calculateJournalProgress = (sections) => {
  const journal =
    sections.journal?.status === "ready" ? sections.journal.day : null;
  const wellness = journal?.wellness || {};
  const filled = WELLNESS_FIELDS.filter(
    (field) => wellness[field] !== null && wellness[field] !== undefined,
  ).length;
  const submittedUnits = journal?.status === "submitted" ? 2 : 0;

  return createModuleProgress(filled + submittedUnits, 10);
};

export const calculateTodaySummary = (sections, partialErrors = []) => {
  const moduleProgress = {
    training: calculateTrainingProgress(sections),
    nutrition: calculateNutritionProgress(sections),
    journal: calculateJournalProgress(sections),
  };
  const applicable = Object.values(moduleProgress).filter(
    (progress) => progress.percent !== null,
  );
  const completionPercent =
    applicable.length === 0
      ? 0
      : Math.round(
          applicable.reduce((total, progress) => total + progress.percent, 0) /
            applicable.length,
        );
  const dayStatus =
    applicable.length === 0
      ? "rest_day"
      : completionPercent === 100
        ? "completed"
        : completionPercent === 0
          ? "not_started"
          : "in_progress";

  return {
    dayStatus,
    completionPercent,
    formulaVersion: "today-v2",
    moduleProgress,
    attentionFlags: partialErrors.length > 0 ? ["partial_data"] : [],
  };
};
