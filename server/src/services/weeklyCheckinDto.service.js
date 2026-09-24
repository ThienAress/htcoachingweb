const plain = (document) =>
  document && typeof document.toObject === "function"
    ? document.toObject()
    : document;

export const deriveWeeklyWaistHipRatio = (body = {}) => {
  const { waistCm, hipCm } = body || {};
  const valid = (value) => typeof value === "number" && Number.isFinite(value) && value >= 30 && value <= 300;
  return valid(waistCm) && valid(hipCm)
    ? Math.round((waistCm / hipCm) * 1000) / 1000
    : null;
};

export const toWeeklyCheckinDto = (document) => {
  const value = plain(document);
  if (!value) return null;
  return {
    _id: value._id,
    clientId: value.clientId,
    weekStartDateKey: value.weekStartDateKey,
    timeZone: value.timeZone,
    body: {
      ...(value.body || {}),
      hipCm: value.body?.hipCm ?? null,
      abdomenCm: value.body?.abdomenCm ?? null,
      waistHipRatio: deriveWeeklyWaistHipRatio(value.body),
    },
    status: value.status,
    submittedAt: value.submittedAt || null,
    trainerReview: value.trainerReview || null,
    revision: value.revision,
    correctionCount: value.correctionCount ?? 0,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const toWeeklyCheckinRevisionDto = (document) => {
  const value = plain(document);
  return {
    _id: value._id,
    revision: value.revision,
    actorRole: value.actorRole,
    action: value.action,
    changedAt: value.changedAt,
    reason: value.reason || "",
    changes: value.changes || [],
  };
};
