import { scoreToLevel, round1 } from "./assessment.helpers";

export const MAX_EXERCISES_PER_METRIC = 3;
export const MAX_EXERCISE_NAME_LENGTH = 80;

export const TIER_OPTIONS = [
  { value: "easy", label: "Mức dễ" },
  { value: "standard", label: "Mức tiêu chuẩn" },
  { value: "advanced", label: "Mức nâng cao" },
];

export const TIER_LABELS = Object.fromEntries(
  TIER_OPTIONS.map((item) => [item.value, item.label]),
);

export const LEVEL_OPTIONS = [
  { value: "low", label: "Yếu" },
  { value: "below_average", label: "Dưới trung bình" },
  { value: "average", label: "Trung bình" },
  { value: "good", label: "Tốt" },
];

// Điểm quy đổi khi HLV tự chọn mức cho bài riêng; khớp ngưỡng của scoreToLevel.
const LEVEL_TO_SCORE = {
  low: 2,
  below_average: 4.5,
  average: 6.5,
  good: 9,
};

export const levelToScore = (level) => LEVEL_TO_SCORE[level] ?? "";

const TIER_HEADER = /^Mức (dễ|tiêu chuẩn|nâng cao):$/;
const TIER_BY_HEADER = {
  dễ: "easy",
  "tiêu chuẩn": "standard",
  "nâng cao": "advanced",
};

// Server hiện trả `tiers`; hàm này chỉ là phương án dự phòng cho dữ liệu cũ
// chỉ có `title` dạng "Mức dễ:\n- A\n- B\n\nMức tiêu chuẩn:...".
export const parseTieredSuggestion = (title = "") => {
  const tiers = { easy: [], standard: [], advanced: [] };
  let current = null;
  String(title || "")
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      const header = line.match(TIER_HEADER);
      if (header) {
        current = TIER_BY_HEADER[header[1]];
        return;
      }
      if (current && line.startsWith("- ")) {
        const name = line.slice(2).trim();
        if (name) tiers[current].push(name);
      }
    });
  return tiers;
};

export const getSuggestionTiers = (suggestion) => {
  if (!suggestion) return { easy: [], standard: [], advanced: [] };
  if (suggestion.tiers && typeof suggestion.tiers === "object") {
    return {
      easy: suggestion.tiers.easy || [],
      standard: suggestion.tiers.standard || [],
      advanced: suggestion.tiers.advanced || [],
    };
  }
  return parseTieredSuggestion(suggestion.title);
};

// Ghép gợi ý đúng thẻ theo `key`; dữ liệu cũ không có key thì lùi về thứ tự mảng.
export const pickSuggestion = (suggestions = [], key, fallbackIndex) =>
  suggestions.find((item) => item?.key === key) ||
  (suggestions.every((item) => !item?.key)
    ? suggestions[fallbackIndex] || null
    : null);

export const createExercise = ({ name, source = "system", tier = "" }) => ({
  name: String(name || "").trim().slice(0, MAX_EXERCISE_NAME_LENGTH),
  source,
  tier,
  inputMode: "",
  sets: "",
  reps: "",
  durationSec: "",
  result: "",
  score: "",
  level: "",
  notes: "",
  selectedProtocol: null,
});

export const canAddExercise = (exercises = [], name = "") => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return false;
  if (exercises.length >= MAX_EXERCISES_PER_METRIC) return false;
  return !exercises.some(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
  );
};

// Điểm trung bình các bài đã có điểm → score/level cấp thẻ cho consumer cũ.
export const aggregateExercises = (exercises = []) => {
  const scores = exercises
    .map((item) => Number(item.score))
    .filter((value, index) => exercises[index].score !== "" && Number.isFinite(value));
  if (!scores.length) return { score: "", level: "" };
  const average = round1(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  return { score: String(average), level: scoreToLevel(average) };
};

// Chuẩn chấm điểm mặc định khi bài không có protocol riêng (bài của HLV hoặc
// gợi ý thiếu): 2–3 hiệp × 8–10 lần hoặc 2–3 hiệp × 20–30 giây.
// Làm đủ mức tối đa (3 hiệp × 10 lần) → điểm 10; giảm hiệp/lần thì điểm giảm theo.
export const DEFAULT_PROTOCOLS = {
  reps: {
    label: "2-3 hiệp × 8-10 lần",
    mode: "reps",
    setsMin: 2,
    setsMax: 3,
    valueMin: 8,
    valueMax: 10,
    unit: "reps",
  },
  time: {
    label: "2-3 hiệp × 20-30 giây",
    mode: "time",
    setsMin: 2,
    setsMax: 3,
    valueMin: 20,
    valueMax: 30,
    unit: "seconds",
  },
};

export const pickProtocol = (mode, protocolOptions = []) => {
  if (mode !== "reps" && mode !== "time") return null;
  return (
    protocolOptions.find((option) => option.mode === mode) ||
    DEFAULT_PROTOCOLS[mode]
  );
};

export const describeTopResult = (protocol) => {
  if (!protocol) return "";
  const sets = protocol.setsMax || protocol.setsMin;
  const value = protocol.valueMax || protocol.valueMin;
  if (!sets || !value) return "";
  return protocol.mode === "time"
    ? `${sets} hiệp × ${value} giây`
    : `${sets} hiệp × ${value} lần`;
};
