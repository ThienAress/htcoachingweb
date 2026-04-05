export const muscleGroups = [
  { id: "chest", name: "CHEST DAY", color: "#ff4d4f" },
  { id: "shoulder", name: "SHOULDER DAY", color: "#faad14" },
  { id: "back", name: "BACK DAY", color: "#52c41a" },
  { id: "leg", name: "LEG DAY", color: "#1890ff" },
  { id: "cardio", name: "CARDIO", color: "#722ed1" },
  { id: "custom", name: "CHỌN NHÓM CƠ", color: "#13c2c2" },
];

export const workoutSections = [
  {
    id: "warmUp",
    title: "WARM UP",
    columns: ["exercises", "sets", "duration", "tips"],
  },
  {
    id: "strength",
    title: "STRENGTH PREPARATION",
    columns: ["exercises", "sets", "reps", "tempo", "duration", "tips"],
  },
  {
    id: "compound",
    title: "COMPOUND TRAINING",
    columns: ["exercises", "sets", "reps", "tempo", "duration", "tips"],
  },
  {
    id: "isolation",
    title: "ISOLATION TRAINING",
    columns: ["exercises", "sets", "reps", "tempo", "duration", "tips"],
  },
  {
    id: "cooldown",
    title: "COOLDOWN / STRETCHING",
    columns: ["exercises", "sets", "duration", "tips"],
  },
];

export const workoutExplanations = [
  {
    title: "WARM UP",
    description: "Làm nóng toàn bộ cơ thể, tăng tuần hoàn (5–10 phút)",
  },
  {
    title: "STRENGTH PREPARATION",
    description:
      "Kích hoạt các nhóm cơ và hệ thần kinh sẽ sử dụng trong phần tập chính",
  },
  {
    title: "COMPOUND TRAINING",
    description:
      "Tập trung vào các bài tập sử dụng nhiều nhóm cơ và nhiều khớp cùng lúc",
  },
  {
    title: "ISOLATION TRAINING",
    description: "Chỉ tập trung vào 1 nhóm cơ riêng biệt",
  },
  {
    title: "COOLDOWN / STRETCHING",
    description: "Kéo giãn cơ bắp, giảm đau mỏi sau tập",
  },
];
