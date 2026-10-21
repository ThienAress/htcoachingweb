import { LEVEL_LABELS, TEST_METRIC_KEYS, TEST_METRICS } from "./constants.js";
import {
  ROCKPORT_VALIDATED_AGE,
  estimateVo2MaxRockport,
  levelToRank,
  ratePlank,
  ratePushUp,
  rankToLevel,
  rateChairStand,
  rateVo2Max,
} from "./norms.js";

const num = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));

const baseEntry = (key, entry) => ({
  exercise: TEST_METRICS[key].exercise,
  variant: entry.variant || "",
  value: num(entry[TEST_METRICS[key].valueKey]),
});

const rateMetric = (key, entry, profile) => {
  const { gender } = profile;
  const age = num(profile.age);
  const base = baseEntry(key, entry);
  const out = { ...base, level: null, note: "" };
  if (!Number.isFinite(base.value)) return out;

  if (key === "upperBodyPush") {
    out.level = ratePushUp({ gender, variant: entry.variant, reps: base.value, age });
    if (!out.level) {
      out.note =
        "Biến thể này chưa có bảng chuẩn công bố cho giới tính và độ tuổi của bạn, nên chỉ lưu làm mốc so sánh lần sau.";
    }
  } else if (key === "lowerBody") {
    out.level = rateChairStand({ gender, reps: base.value, age });
    if (!out.level) {
      out.note =
        "Bài này chỉ có bảng chuẩn công bố cho người từ 60 tuổi; kết quả được lưu làm mốc so sánh lần sau.";
    }
  } else if (key === "coreEndurance") {
    out.level = entry.variant === "full" ? ratePlank({ seconds: base.value }) : null;
    if (!out.level) {
      out.note = "Biến thể giảm tải chỉ lưu làm mốc, chưa xếp mức.";
    } else {
      out.note = "Mốc tham khảo thực dụng từ nghiên cứu trên vận động viên trẻ, chưa phải bảng chuẩn quần thể.";
    }
  } else if (key === "cardio") {
    const vo2max = estimateVo2MaxRockport({
      gender,
      age,
      weightKg: num(profile.weightKg),
      minutes: base.value,
      endHeartRate: num(entry.endHeartRate),
    });
    out.vo2max = vo2max;
    out.level = rateVo2Max({ gender, vo2max, age });
    if (out.level && (age < ROCKPORT_VALIDATED_AGE.min || age > ROCKPORT_VALIDATED_AGE.max)) {
      out.note = "Công thức Rockport được kiểm chứng ở tuổi 30-69; với tuổi của bạn đây chỉ là ước lượng tham khảo.";
    }
  }
  if (out.level) out.levelLabel = LEVEL_LABELS[out.level];
  return out;
};

export const scoreTests = ({ tests = {}, profile = {} } = {}) => {
  const metrics = {};
  TEST_METRIC_KEYS.forEach((key) => {
    const entry = tests[key];
    if (entry && typeof entry === "object") metrics[key] = rateMetric(key, entry, profile);
  });

  const ranks = Object.values(metrics)
    .map((metric) => levelToRank(metric.level))
    .filter((rank) => rank !== null);
  const ratedCount = ranks.length;
  const overallRank = ratedCount ? ranks.reduce((sum, rank) => sum + rank, 0) / ratedCount : null;
  const overallLevel = overallRank === null ? null : rankToLevel(overallRank);

  return {
    metrics,
    ratedCount,
    overallLevel,
    overallLevelLabel: overallLevel ? LEVEL_LABELS[overallLevel] : "",
    overallRank: overallRank === null ? null : Number(overallRank.toFixed(2)),
  };
};
