import {
  computeCardioCapacityScore,
  computeRecoveryScore,
  scoreAgainstProtocol,
  scoreToLevel,
} from "./assessment.helpers";
import { DEFAULT_PROTOCOLS } from "./assessmentExercises";
import { OHSA_LABELS } from "../constants/f1Ohsa";

export const OHSA_VIEWS = [
  { value: "anterior", label: "Mặt trước" },
  { value: "lateral", label: "Mặt bên" },
  { value: "posterior", label: "Mặt sau" },
];

export const ohsaItemLabel = (item) =>
  OHSA_LABELS[item.key] || item.label || item.key || "";

// Biểu hiện cần kiểm lại (từ giai đoạn trước) giữ trạng thái đã lưu; biểu hiện mới do HLV thêm.
const buildOhsaItems = (context, review) => {
  const saved = review?.ohsa?.items || [];
  const savedStatus = new Map(
    saved.map((item) => [`${item.view}|${item.key || item.label}`, item.status]),
  );
  const baseline = (context.ohsaItems || []).map((item) => ({
    view: item.view,
    key: item.key,
    label: ohsaItemLabel(item),
    status:
      savedStatus.get(`${item.view}|${item.key}`) === "resolved" ? "resolved" : "persists",
    fixed: true,
  }));
  const added = saved
    .filter((item) => item.status === "new")
    .map((item) => ({ view: item.view, key: "", label: item.label, status: "new", fixed: false }));
  return [...baseline, ...added];
};

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
const RESULT_SCORERS = {
  minutes: computeCardioCapacityScore,
  hr_drop: computeRecoveryScore,
};

export const RESULT_LABELS = {
  minutes: "Kết quả (phút)",
  hr_drop: "Nhịp tim giảm sau 1 phút",
};

// Cách nhập lại đúng như lúc đánh giá ban đầu: một kết quả, hiệp × giây hoặc hiệp × lần.
export const retestMode = (item) =>
  item.resultKind
    ? "result"
    : item.selectedProtocol?.mode || item.inputMode || "reps";

export const retestLevel = (item) => {
  if (item.resultKind) {
    const score = RESULT_SCORERS[item.resultKind]?.(item.result) ?? "";
    return score === "" ? "" : scoreToLevel(score);
  }
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
  Boolean(
    item.resultKind ||
      item.selectedProtocol?.mode ||
      DEFAULT_PROTOCOLS[item.inputMode],
  );

// Kết quả lần trước, hiển thị gọn cho HLV nhớ lại.
export const describePrevious = (item) => {
  const previous = item.previous || {};
  const parts = [];
  if (item.resultKind === "minutes" && previous.result) parts.push(`${previous.result} phút`);
  else if (item.resultKind === "hr_drop" && previous.result) parts.push(`nhịp tim giảm ${previous.result}`);
  else if (previous.sets && previous.durationSec) parts.push(`${previous.sets} hiệp × ${previous.durationSec} giây`);
  else if (previous.sets && previous.reps) parts.push(`${previous.sets} hiệp × ${previous.reps} reps`);
  if (LEVEL_LABELS[item.previousLevel]) parts.push(LEVEL_LABELS[item.previousLevel]);
  return parts.join(" · ");
};

export const computeBmi = (weightKg, heightCm) => {
  const weight = toNumber(weightKg);
  const height = Number(heightCm);
  if (!weight || !height) return null;
  const meters = height / 100;
  return Math.round((weight / (meters * meters)) * 10) / 10;
};

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
        result: toInput(saved.result),
        manualLevel: canAutoScore(item) ? "" : saved.level || "",
      };
    }),
    ohsa: { items: buildOhsaItems(context, review) },
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
      result: toNumber(item.result),
      level: retestLevel(item),
    }))
    .filter((item) => item.level),
  ohsa: {
    items: values.ohsa.items
      .filter((item) => item.view && item.label.trim())
      .map((item) => ({
        view: item.view,
        key: item.fixed ? item.key : "",
        label: item.label.trim(),
        status: item.status,
      })),
  },
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

const UNIT_BY_KEY = { weightKg: "kg", waistCm: "cm", hipCm: "cm", bodyFatPercent: "%", restingHeartRate: "bpm", bmi: "" };

// Giá trị kèm đơn vị, ví dụ "-5 kg"; dùng dấu trừ thật cho dễ đọc.
export const formatDeltaWithUnit = (value, key) => {
  const delta = formatDelta(value);
  if (delta === "--") return delta;
  const unit = UNIT_BY_KEY[key];
  return unit ? `${delta} ${unit}` : delta;
};
