const ACTOR_LABELS = {
  user: "Bạn",
  trainer: "Huấn luyện viên",
  admin: "Quản trị viên",
};

export const activityActorLabel = (role) =>
  ACTOR_LABELS[role] || "Hệ thống";
