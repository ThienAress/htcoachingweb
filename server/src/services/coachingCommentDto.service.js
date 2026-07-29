const plain = (document) =>
  document && typeof document.toObject === "function"
    ? document.toObject()
    : document;

export const toCoachingCommentDto = (document, viewerId = null) => {
  const value = plain(document);
  if (!value) return null;
  return {
    _id: value._id,
    targetType: value.targetType,
    targetId: value.targetId,
    targetDateKey: value.targetDateKey || "",
    actorId: value.actorId,
    actorRole: value.actorRole,
    isMine: viewerId ? String(value.actorId) === String(viewerId) : false,
    body: value.status === "removed" ? "" : value.body,
    status: value.status,
    revision: value.revision,
    editedAt: value.editedAt || null,
    removedAt: value.removedAt || null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};
