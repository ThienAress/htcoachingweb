export const commentThreadKey = (targetType, targetId, page) => [
  "coaching-comments",
  targetType,
  targetId,
  ...(page ? [page] : []),
];

export const commentDisplay = (comment) => {
  const removed = comment.status === "removed";
  return {
    body: removed
      ? "Bình luận đã được gỡ"
      : String(comment.body || "").trim(),
    authorLabel:
      ["trainer", "admin"].includes(comment.actorRole)
        ? "Huấn luyện viên"
        : comment.isMine
          ? "Bạn"
          : "Học viên",
    canChange: Boolean(comment.isMine && !removed),
    removed,
  };
};
