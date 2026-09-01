export const FIXTURE_VERSION = "exercise-library-v2";

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
};

export const EXERCISE_FIXTURE = deepFreeze([
  {
    _id: "chest-dumbbell-press",
    name: "Đẩy ngực với tạ đơn",
    muscleGroup: "Cơ ngực",
    description: "Bài compound cho ngực với ghế phẳng.",
    technicalDifficultyRating: 3,
  },
  {
    _id: "basic-push-up",
    name: "Chống đẩy cơ bản",
    muscleGroup: "Cơ ngực",
    description: "Dùng trọng lượng cơ thể và giữ thân người ổn định.",
    technicalDifficultyRating: 2,
  },
  {
    _id: "shoulder-dumbbell-press",
    name: "Đẩy vai với tạ đơn",
    muscleGroup: "Cơ vai",
    description: "Đưa tạ lên cao trong khi giữ thân trên vững.",
    technicalDifficultyRating: 3,
  },
  {
    _id: "wide-grip-lat-pulldown",
    name: "Kéo xô tay rộng",
    muscleGroup: "Cơ lưng",
    description: "Kéo cáp xuống trước ngực và kiểm soát bả vai.",
    technicalDifficultyRating: 2,
  },
  {
    _id: "seated-cable-row",
    name: "Chèo cáp ngồi",
    muscleGroup: "Cơ lưng",
    description: "Giữ cột sống trung lập khi đưa khuỷu tay về sau.",
    technicalDifficultyRating: 4,
  },
  {
    _id: "dumbbell-romanian-deadlift",
    name: "Romanian Deadlift với tạ đơn",
    muscleGroup: "Cơ đùi trước / Đùi sau",
    description: "Gập hông có kiểm soát để tập chuỗi cơ sau.",
    technicalDifficultyRating: 4,
  },
  {
    _id: "goblet-squat",
    name: "Goblet Squat",
    muscleGroup: "Chân",
    description: "Ôm một quả tạ trước ngực và ngồi xuống có kiểm soát.",
    technicalDifficultyRating: 2,
  },
  {
    _id: "hip-thrust",
    name: "Hip Thrust",
    muscleGroup: "Mông",
    description: "Duỗi hông trên ghế và siết cơ mông ở điểm cao nhất.",
    technicalDifficultyRating: 4,
  },
  {
    _id: "glute-bridge",
    name: "Cầu mông",
    muscleGroup: "Mông",
    description: "Nằm ngửa, nâng hông và giữ xương sườn ổn định.",
    technicalDifficultyRating: 1,
  },
  {
    _id: "forearm-plank",
    name: "Plank cẳng tay",
    muscleGroup: "Cơ bụng / Eo",
    description: "Giữ đường thẳng từ đầu đến gót chân.",
    technicalDifficultyRating: null,
  },
  {
    _id: "burpee",
    name: "Burpee",
    muscleGroup: "Cardio / Tim mạch",
    description: "Chuỗi động tác toàn thân kết hợp squat, plank và bật nhảy.",
    technicalDifficultyRating: 5,
  },
]);

export const JUDGED_QUERIES = deepFreeze([
  {
    id: "vi-accented",
    queryClass: "vi-accented",
    searchTerm: "đẩy ngực",
    relevantIds: ["chest-dumbbell-press"],
  },
  {
    id: "vi-unaccented",
    queryClass: "vi-unaccented",
    searchTerm: "nguc",
    relevantIds: ["chest-dumbbell-press", "basic-push-up"],
  },
  {
    id: "vi-unaccented-d-stroke",
    queryClass: "vi-unaccented",
    searchTerm: "day nguc",
    relevantIds: ["chest-dumbbell-press"],
  },
  {
    id: "typo",
    queryClass: "typo",
    searchTerm: "kéo xô tay rộgn",
    relevantIds: ["wide-grip-lat-pulldown"],
  },
  {
    id: "missing-token",
    queryClass: "missing-token",
    searchTerm: "đẩy tạ đơn",
    relevantIds: ["chest-dumbbell-press", "shoulder-dumbbell-press"],
  },
  {
    id: "synonym",
    queryClass: "synonym",
    searchTerm: "hít đất",
    relevantIds: ["basic-push-up"],
  },
  {
    id: "cross-field-plank-core",
    queryClass: "cross-field",
    searchTerm: "plank bụng",
    relevantIds: ["forearm-plank"],
  },
  {
    id: "cross-field-pull-back",
    queryClass: "cross-field",
    searchTerm: "kéo lưng",
    relevantIds: ["wide-grip-lat-pulldown"],
  },
  {
    id: "hard-negative-stop",
    queryClass: "hard-negative",
    searchTerm: "dừng",
    relevantIds: [],
    expectedNoResults: true,
  },
  {
    id: "hard-negative-horse",
    queryClass: "hard-negative",
    searchTerm: "ngựa",
    relevantIds: [],
    expectedNoResults: true,
  },
  {
    id: "no-hit",
    queryClass: "no-hit",
    searchTerm: "bay trên không",
    relevantIds: [],
    expectedNoResults: true,
  },
  {
    id: "filter-muscle-group",
    queryClass: "filter",
    muscleGroup: "Mông",
    relevantIds: ["hip-thrust", "glute-bridge"],
  },
  {
    id: "filter-combined",
    queryClass: "filter",
    searchTerm: "đẩy",
    muscleGroup: "Cơ vai",
    relevantIds: ["shoulder-dumbbell-press"],
  },
  {
    id: "filter-difficulty",
    queryClass: "filter",
    difficulty: "3",
    relevantIds: ["chest-dumbbell-press", "shoulder-dumbbell-press"],
  },
  {
    id: "filter-unrated",
    queryClass: "filter",
    difficulty: "unrated",
    relevantIds: ["forearm-plank"],
  },
  {
    id: "filter-no-hit",
    queryClass: "filter",
    searchTerm: "squat",
    muscleGroup: "Cơ ngực",
    relevantIds: [],
    expectedNoResults: true,
  },
]);
