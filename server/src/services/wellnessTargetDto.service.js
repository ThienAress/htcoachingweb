const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

export const toWellnessTargetDto = (document) => {
  if (!document) return null;
  const value =
    typeof document.toObject === "function" ? document.toObject() : document;
  return {
    _id: id(value._id),
    clientId: id(value.clientId),
    version: value.version,
    effectiveFromDateKey: value.effectiveFromDateKey,
    targets: {
      sleepHours: value.targets.sleepHours,
      waterMl: value.targets.waterMl,
      steps: value.targets.steps,
    },
    note: value.note || "",
    updatedByRole: value.updatedByRole,
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
};
