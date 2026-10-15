import { scoreAgainstProtocol, scoreToLevel } from "./assessment.helpers";
import { DEFAULT_PROTOCOLS } from "./assessmentExercises";

export const phaseReviewsQueryKey = (customerId) => ["f1-phase-reviews", customerId];

export const QUALITY_OPTIONS = [
  { value: "good", label: "Tốt" },
  { value: "fair", label: "Khá" },
  { value: "poor", label: "Chưa đạt" },
];

export const STATUS_OPTIONS = [
  { value: "met", label: "Đạt" },
  { value: "partial", label: "Một phần" },
  { value: "not_met", label: "Chưa" },
];

export const LEVEL_LABELS = {
  low: "Yếu",
  below_average: "Dưới trung bình",
  average: "Trung bình",
  good: "Tốt",
};

export const DECISION_META = {
  advance: { label: "Đủ điều kiện chuyển giai đoạn", tone: "good" },
  extend: { label: "Kéo dài giai đoạn hiện tại", tone: "warn" },
  repeat: { label: "Lặp lại giai đoạn hiện tại", tone: "bad" },
  coach_review: { label: "Cần HLV xem lại trước khi chuyển", tone: "bad" },
};

export const COMPONENT_LABELS = {
  sessions: "Tập đủ buổi",
  advice: "Làm theo lời khuyên giai đoạn trước",
  retest: "Kết quả test lại",
  ohsa: "Squat tay qua đầu (Overhead Squat)",
  body: "Chỉ số cơ thể",
};

const toInput = (value) =>
  value === null || value === undefined ? "" : String(value);
const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const todayKey = () => new Date().toISOString().slice(0, 10);

// Mức của bài test lại: bài có chế độ reps/giây chấm theo cùng chuẩn với lần đánh giá
// ban đầu; bài không chấm tự động được thì HLV tự chọn mức.
export const retestLevel = (item) => {
  const protocol =
    item.selectedProtocol || DEFAULT_PROTOCOLS[item.inputMode] || null;
  if (!protocol) return item.manualLevel || "";
  const score = scoreAgainstProtocol({
    selectedProtocol: protocol,
    sets: item.sets,
    reps: item.reps,
    durationSec: item.durationSec,
  });
  return score === "" ? "" : scoreToLevel(score);
};

export const canAutoScore = (item) =>
  Boolean(item.selectedProtocol?.mode || DEFAULT_PROTOCOLS[item.inputMode]);

export const buildFormDefaults = (context, review = null) => {
  const actual = review?.actual || {};
  const adherence = review?.adherence || {};
  const savedChecks = new Map(
    (review?.recommendationChecks || []).map((item) => [item.text, item.status]),
  );
  const savedRetests = new Map(
    (review?.retests || []).map((item) => [`${item.metricKey}|${item.name}`, item]),
  );
  return {
    measuredAt: review?.measuredAt
      ? String(review.measuredAt).slice(0, 10)
      : todayKey(),
    actual: {
      weightKg: toInput(actual.weightKg),
      waistCm: toInput(actual.waistCm),
      hipCm: toInput(actual.hipCm),
      bodyFatPercent: toInput(actual.bodyFatPercent),
      restingHeartRate: toInput(actual.restingHeartRate),
    },
    adherence: {
      plannedSessions: toInput(adherence.plannedSessions ?? context.plannedSessions),
      completedSessions: toInput(adherence.completedSessions),
      nutrition: adherence.nutrition || "fair",
      sleep: adherence.sleep || "fair",
    },
    recommendationChecks: (context.recommendations || []).map((text) => ({
      text,
      status: savedChecks.get(text) || "",
    })),
    retests: (context.retests || []).map((item) => {
      const saved = savedRetests.get(`${item.metricKey}|${item.name}`) || {};
      return {
        ...item,
        sets: toInput(saved.sets),
        reps: toInput(saved.reps),
        durationSec: toInput(saved.durationSec),
        manualLevel: canAutoScore(item) ? "" : saved.level || "",
      };
    }),
    ohsa: {
      anteriorIssue: Boolean(review?.ohsa?.anteriorIssue),
      lateralIssue: Boolean(review?.ohsa?.lateralIssue),
      posteriorIssue: Boolean(review?.ohsa?.posteriorIssue),
    },
    safety: {
      newPain: Boolean(review?.safety?.newPain),
      newInjury: Boolean(review?.safety?.newInjury),
      warningSigns: Boolean(review?.safety?.warningSigns),
      note: review?.safety?.note || "",
    },
  };
};

export const toPayload = (values) => ({
  measuredAt: new Date(`${values.measuredAt}T12:00:00`).toISOString(),
  actual: Object.fromEntries(
    Object.entries(values.actual).map(([key, value]) => [key, toNumber(value)]),
  ),
  adherence: {
    plannedSessions: toNumber(values.adherence.plannedSessions),
    completedSessions: toNumber(values.adherence.completedSessions),
    nutrition: values.adherence.nutrition,
    sleep: values.adherence.sleep,
  },
  recommendationChecks: values.recommendationChecks.map((item) => ({
    text: item.text,
    status: item.status,
  })),
  // Bài chưa nhập kết quả thì không gửi, để không bị tính là xuống mức.
  retests: values.retests
    .map((item) => ({
      metricKey: item.metricKey,
      name: item.name,
      tier: item.tier || "",
      sets: toNumber(item.sets),
      reps: toNumber(item.reps),
      durationSec: toNumber(item.durationSec),
      level: retestLevel(item),
    }))
    .filter((item) => item.level),
  ohsa: values.ohsa,
  safety: { ...values.safety, note: values.safety.note.trim() },
});

// Hiển thị số đo: tối đa 1 chữ số thập phân, dấu phẩy theo kiểu Việt Nam.
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
export const formatNumber = (value) =>
  value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? "--"
    : numberFormat.format(Number(value));
export const formatDelta = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  const number = Number(value);
  if (number === 0) return "0";
  return `${number > 0 ? "+" : "−"}${numberFormat.format(Math.abs(number))}`;
};
