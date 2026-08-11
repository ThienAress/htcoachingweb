export const AI_MEMORY_FIELDS = [
  {
    kind: "response_style",
    label: "Cách trả lời",
    options: [
      ["concise", "Ngắn gọn"],
      ["balanced", "Cân bằng"],
      ["detailed", "Chi tiết"],
    ],
  },
  {
    kind: "training_environment",
    label: "Nơi tập ưu tiên",
    options: [
      ["home", "Tại nhà"],
      ["gym", "Phòng gym"],
      ["outdoors", "Ngoài trời"],
    ],
  },
  {
    kind: "preferred_workout_time",
    label: "Thời gian tập",
    options: [
      ["morning", "Buổi sáng"],
      ["afternoon", "Buổi chiều"],
      ["evening", "Buổi tối"],
    ],
  },
  {
    kind: "dietary_style",
    label: "Kiểu ăn ưu tiên",
    options: [
      ["balanced", "Cân bằng"],
      ["vegetarian", "Ăn chay"],
      ["vegan", "Thuần chay"],
      ["pescatarian", "Pescatarian"],
    ],
  },
  {
    kind: "fitness_goal",
    label: "Mục tiêu fitness",
    options: [
      ["fat_loss", "Giảm mỡ"],
      ["maintenance", "Duy trì"],
      ["muscle_gain", "Tăng cơ"],
    ],
  },
];
