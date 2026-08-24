const plain = (document) =>
  document && typeof document.toObject === "function"
    ? document.toObject()
    : document;

export const toWeeklyCheckinDto = (document) => {
  const value = plain(document);
  if (!value) return null;
  return {
    _id: value._id,
    clientId: value.clientId,
    weekStartDateKey: value.weekStartDateKey,
    timeZone: value.timeZone,
    body: value.body || {},
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
