const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

export const toCoachingHabitDto = (document, derived = {}) => {
  const value = typeof document.toObject === "function" ? document.toObject() : document;
  return {
    _id: id(value._id),
    clientId: id(value.clientId),
    trainerIdAtCreation: id(value.trainerIdAtCreation),
    createdByRole: value.createdByRole,
    lineageKey: value.lineageKey,
    version: value.version,
    isLatest: Boolean(value.isLatest),
    status: value.status,
    title: value.title,
    description: value.description || "",
    category: value.category,
    schedule: value.schedule,
    target: value.target ?? null,
    unit: value.unit || "",
    visibility: value.visibility,
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
    ...derived,
  };
};
