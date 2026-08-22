const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

const toNutritionDto = (nutrition) => ({
  assignment: nutrition?.assignment
    ? {
        savedMealPlanId: id(nutrition.assignment.savedMealPlanId),
        lineageKey: nutrition.assignment.lineageKey,
        version: nutrition.assignment.version,
        titleSnapshot: nutrition.assignment.titleSnapshot,
        assignedAt: iso(nutrition.assignment.assignedAt),
      }
    : null,
  entries: (nutrition?.entries || []).map((entry) => ({
    entryId: entry.entryId,
    mode: entry.mode,
    status: entry.status,
    plannedMealKey: entry.plannedMealKey || "",
    savedMealPlanId: id(entry.savedMealPlanId),
    version: entry.version ?? null,
    recipeId: id(entry.recipeId),
    recipeSlugSnapshot: entry.recipeSlugSnapshot || "",
    labelSnapshot: entry.labelSnapshot,
    description: entry.description || "",
    note: entry.note || "",
    recordedAt: iso(entry.recordedAt),
  })),
});

export const toDailyJournalDto = (
  document,
  { includePrivate = true } = {},
) => {
  if (!document) return null;
  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;
  const wellness = {
    sleepHours: value.wellness?.sleepHours ?? null,
    waterMl: value.wellness?.waterMl ?? null,
    steps: value.wellness?.steps ?? null,
    energy: value.wellness?.energy ?? null,
    hunger: value.wellness?.hunger ?? null,
    stress: value.wellness?.stress ?? null,
    soreness: value.wellness?.soreness ?? null,
    pain: value.wellness?.pain ?? null,
    painArea: value.wellness?.painArea || "",
  };
  const completionFields = Object.entries(wellness).filter(
    ([key]) => key !== "painArea",
  );
  const filled = completionFields.filter(
    ([, fieldValue]) => fieldValue !== null,
  ).length;
  return {
    _id: id(value._id),
    dateKey: value.dateKey,
    timeZone: value.timeZone,
    wellness,
    notes: {
      ...(includePrivate
        ? { private: value.notes?.private || "" }
        : {}),
      shared: value.notes?.shared || "",
    },
    nutrition: toNutritionDto(value.nutrition),
    habitCompletions: (value.habitCompletions || []).map((completion) => ({
      habitId: id(completion.habitId),
      lineageKey: completion.lineageKey,
      version: completion.version,
      titleSnapshot: completion.titleSnapshot,
      status: completion.status,
      recordedAt: iso(completion.recordedAt),
    })),
    status: value.status,
    submittedAt: iso(value.submittedAt),
    revision: value.revision,
    correctionCount: value.correctionCount ?? 0,
    completion: {
      filled,
      total: completionFields.length,
      percent: Math.round((filled / completionFields.length) * 100),
    },
    updatedAt: iso(value.updatedAt),
  };
};

export const toDailyJournalRevisionDto = (document) => {
  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;
  return {
    _id: id(value._id),
    revision: value.revision,
    actorRole: value.actorRole,
    action: value.action,
    changedAt: iso(value.changedAt),
    reason: value.reason || "",
    changes: (value.changes || []).map((change) => ({
      path: change.path,
      before: change.before ?? null,
      after: change.after ?? null,
    })),
  };
};
