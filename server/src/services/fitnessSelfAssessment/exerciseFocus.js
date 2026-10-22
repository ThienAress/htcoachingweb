import { LEVEL_LABELS, TEST_METRICS } from "./constants.js";
import { EXERCISES_BY_METRIC } from "./recommendationContent.js";

// Chọn bậc bài tập theo mức hiện tại: thấp -> giảm tải, khá -> chuẩn, tốt trở lên -> nâng cao.
const tierFor = ({ rank, phase, caution }) => {
  if (rank === null) return phase === "phase_1" || caution ? 0 : 1;
  if (rank <= 2) return 0;
  if (rank === 3) return 1;
  return caution ? 1 : 2;
};

// Nhóm cần ưu tiên: mức "cần cải thiện/trung bình", hoặc lệch giữa thân trên và thân dưới từ 2 bậc.
export const buildExerciseFocus = ({ metricRanks = {}, metrics = {}, phase, caution = false }) => {
  const focusKeys = new Set();
  Object.entries(metricRanks).forEach(([key, rank]) => {
    if (rank !== null && rank <= 2) focusKeys.add(key);
  });
  const upper = metricRanks.upperBodyPush;
  const lower = metricRanks.lowerBody;
  if (upper && lower && Math.abs(upper - lower) >= 2) focusKeys.add(upper < lower ? "upperBodyPush" : "lowerBody");

  // Nhóm chưa xếp mức vẫn có gợi ý nền để tiếp tục phát triển.
  Object.keys(TEST_METRICS).forEach((key) => {
    if (metricRanks[key] === null || metricRanks[key] === undefined) focusKeys.add(key);
  });

  return [...focusKeys].map((key) => {
    const rank = metricRanks[key] ?? null;
    const metric = metrics[key];
    return {
      metric: key,
      label: TEST_METRICS[key].label,
      level: metric?.level || null,
      levelLabel: metric?.level ? LEVEL_LABELS[metric.level] : "Chưa xếp mức",
      exercises: EXERCISES_BY_METRIC[key][tierFor({ rank, phase, caution })],
    };
  });
};
