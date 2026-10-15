// Chấm "mức hoàn thành giai đoạn" cho đánh giá cuối giai đoạn của khách F1.
//
// Trọng số (tổng 100): tập đủ buổi 20, làm theo lời khuyên 20, test lại 30,
// Squat tay qua đầu 10, chỉ số cơ thể 20. Thành phần không có dữ liệu được bỏ ra
// và quy đổi lại theo phần còn lại.
//
// Ngưỡng 80% (chuyển) / 60% (kéo dài) là quy ước nội bộ để HLV dễ theo dõi,
// không phải chuẩn y khoa. NASM khuyên chuyển giai đoạn theo năng lực từng người
// (thường 4–6 tuần/giai đoạn): https://blog.nasm.org/opt-model-phase-1
import { PHASE_META, PHASE_ORDER } from "./resultPrediction.helpers.js";

export const ADVANCE_THRESHOLD = 80;
export const EXTEND_THRESHOLD = 60;
// Giai đoạn cao nhất hệ thống tự đề xuất cho các mục tiêu hiện có (giảm mỡ, tăng cơ,
// tăng cân, duy trì). Sức mạnh tối đa và sức bật cần mục tiêu thành tích riêng.
export const AUTO_PHASE_CEILING = "phase_3";
// Giảm cân trung bình nhanh hơn ~1% cân nặng mỗi tuần là nhanh hơn khuyến nghị
// (NHLBI: 0,5–1 kg/tuần): https://www.nhlbi.nih.gov/health/educational/lose_wt/guidelines.htm
const FAST_LOSS_WEEKLY_PERCENT = 1;

const LEVEL_ORDER = ["low", "below_average", "average", "good"];
export const LEVEL_LABELS = {
  low: "Yếu",
  below_average: "Dưới trung bình",
  average: "Trung bình",
  good: "Tốt",
};
const STATUS_VALUE = { met: 1, partial: 0.5, not_met: 0 };
const QUALITY_VALUE = { good: 1, fair: 0.6, poor: 0.2 };
const OHSA_VIEWS = [
  ["anteriorIssue", "mặt trước"],
  ["lateralIssue", "mặt bên"],
  ["posteriorIssue", "mặt sau"],
];

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const round1 = (num) => Math.round(Number(num || 0) * 10) / 10;
const levelRank = (level) => LEVEL_ORDER.indexOf(level);
const num = (value) =>
  value === null || value === undefined || value === "" ? null : Number(value);

// Điểm 0–1 của một bài test lại so với lần test trước.
export const scoreRetest = ({ previousLevel, level }) => {
  const now = levelRank(level);
  if (now < 0) return null;
  const before = levelRank(previousLevel);
  if (before < 0) return [0.2, 0.4, 0.7, 1][now];
  if (now > before) return 1;
  if (now === before) return level === "good" ? 1 : 0.6;
  return 0;
};

// Tỷ lệ thay đổi thực tế / dự kiến; đạt 80% mức dự kiến là đủ điểm.
const progressRatio = (start, projected, actual) => {
  if (start === null || projected === null || actual === null) return null;
  const expected = projected - start;
  if (Math.abs(expected) < 0.05) return null;
  return clamp((actual - start) / expected / 0.8, 0, 1);
};

export const scoreBody = ({ primaryGoal, start = {}, projected = {}, actual }) => {
  const startWeight = num(start.weightKg);
  if (primaryGoal === "maintenance") {
    if (!startWeight) return null;
    const drift = Math.abs(actual.weightKg - startWeight) / startWeight;
    return drift <= 0.02 ? 1 : drift <= 0.04 ? 0.5 : 0;
  }
  const keys =
    primaryGoal === "fat_loss" ? ["weightKg", "waistCm"] : ["weightKg"];
  const ratios = keys
    .map((key) => progressRatio(num(start[key]), num(projected[key]), num(actual[key])))
    .filter((value) => value !== null);
  if (!ratios.length) return null;
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
};

const buildComponents = ({ input, context }) => {
  const { adherence, recommendationChecks = [], retests = [], ohsa = {} } = input;
  const sessionRatio = clamp(
    adherence.completedSessions / Math.max(adherence.plannedSessions, 1),
    0,
    1,
  );
  const checkValues = recommendationChecks.map((item) => STATUS_VALUE[item.status] ?? 0);
  const lifestyleValues = [
    QUALITY_VALUE[adherence.nutrition] ?? 0.6,
    QUALITY_VALUE[adherence.sleep] ?? 0.6,
  ];
  const adviceValues = checkValues.length ? checkValues : lifestyleValues;
  const retestValues = retests.map(scoreRetest).filter((value) => value !== null);
  const cleanViews = OHSA_VIEWS.filter(([key]) => !ohsa[key]).length;
  const body = scoreBody({
    primaryGoal: context.primaryGoal,
    start: context.start,
    projected: context.projected,
    actual: input.actual,
  });
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    sessions: { max: 20, ratio: sessionRatio },
    advice: { max: 20, ratio: average(adviceValues) },
    retest: retestValues.length ? { max: 30, ratio: average(retestValues) } : null,
    ohsa: { max: 10, ratio: cleanViews / OHSA_VIEWS.length },
    body: body === null ? null : { max: 20, ratio: body },
  };
};

const buildGaps = ({ input, components }) => {
  const gaps = [];
  const { adherence, recommendationChecks = [], retests = [], ohsa = {} } = input;
  const scale = 100 / Object.values(components).reduce((sum, item) => sum + (item?.max || 0), 0);
  const push = (text, points) => {
    if (points > 0.05) gaps.push({ text, points: round1(points * scale) });
  };

  if (components.sessions.ratio < 1) {
    push(
      `Tập đủ buổi theo kế hoạch (đã tập ${adherence.completedSessions}/${adherence.plannedSessions} buổi)`,
      (1 - components.sessions.ratio) * 20,
    );
  }
  if (recommendationChecks.length) {
    for (const item of recommendationChecks) {
      const value = STATUS_VALUE[item.status] ?? 0;
      push(item.text, ((1 - value) * 20) / recommendationChecks.length);
    }
  } else {
    if (adherence.nutrition !== "good") push("Ăn uống theo hướng dẫn của HLV", ((1 - (QUALITY_VALUE[adherence.nutrition] ?? 0.6)) * 20) / 2);
    if (adherence.sleep !== "good") push("Ngủ đủ giấc (7–9 giờ mỗi đêm)", ((1 - (QUALITY_VALUE[adherence.sleep] ?? 0.6)) * 20) / 2);
  }
  if (components.retest) {
    const scored = retests.filter((item) => scoreRetest(item) !== null);
    for (const item of scored) {
      const value = scoreRetest(item);
      const target = LEVEL_ORDER[Math.min(levelRank(item.level) + 1, LEVEL_ORDER.length - 1)];
      push(`${item.name}: đạt mức ${LEVEL_LABELS[target]}`, ((1 - value) * 30) / scored.length);
    }
  }
  for (const [key, label] of OHSA_VIEWS) {
    if (ohsa[key]) push(`Squat tay qua đầu: hết biểu hiện sai ở ${label}`, 10 / OHSA_VIEWS.length);
  }
  if (components.body && components.body.ratio < 1) {
    push("Bám sát chế độ ăn và vận động để đạt mức thay đổi cơ thể dự kiến", (1 - components.body.ratio) * 20);
  }
  return gaps.sort((a, b) => b.points - a.points);
};

const pointsNeeded = (total, target) => round1(Math.max(target - total, 0));

const pickNextPhase = ({ phaseKey, decision, ohsaIssueCount }) => {
  if (decision !== "advance") return { phaseKey, blockedReason: "" };
  const idx = PHASE_ORDER.indexOf(phaseKey);
  const ceilingIdx = PHASE_ORDER.indexOf(AUTO_PHASE_CEILING);
  const nextIdx = Math.min(idx + 1, ceilingIdx);
  const next = PHASE_ORDER[Math.max(nextIdx, idx)] || phaseKey;
  if (next === "phase_3" && phaseKey !== "phase_3" && ohsaIssueCount >= 2) {
    return {
      phaseKey,
      blockedReason:
        "Squat tay qua đầu còn biểu hiện sai ở từ 2 góc nhìn, nên chưa lên Phát triển cơ bắp (Hypertrophy); tiếp tục giai đoạn hiện tại để chỉnh kỹ thuật.",
    };
  }
  return { phaseKey: next, blockedReason: "" };
};

export const evaluatePhaseReview = ({ input, context }) => {
  const components = buildComponents({ input, context });
  const available = Object.values(components).filter(Boolean);
  const maxPoints = available.reduce((sum, item) => sum + item.max, 0);
  const earned = available.reduce((sum, item) => sum + item.max * item.ratio, 0);
  const total = Math.round((earned / maxPoints) * 1000) / 10;
  const breakdown = Object.fromEntries(
    Object.entries(components).map(([key, item]) => [
      key,
      item ? { points: round1(item.max * item.ratio), max: item.max } : null,
    ]),
  );

  const safety = input.safety || {};
  const safetyFlag = Boolean(safety.newPain || safety.newInjury || safety.warningSigns);
  const decision = safetyFlag
    ? "coach_review"
    : total >= ADVANCE_THRESHOLD
      ? "advance"
      : total >= EXTEND_THRESHOLD
        ? "extend"
        : "repeat";
  const ohsaIssueCount = OHSA_VIEWS.filter(([key]) => input.ohsa?.[key]).length;
  const next = pickNextPhase({ phaseKey: context.phaseKey, decision, ohsaIssueCount });
  // Kéo dài 2–4 tuần: điểm càng thấp càng cần thêm thời gian.
  const extendWeeks =
    decision === "extend"
      ? clamp(Math.round(2 + ((ADVANCE_THRESHOLD - total) / (ADVANCE_THRESHOLD - EXTEND_THRESHOLD)) * 2), 2, 4)
      : 0;

  const warnings = [];
  const startWeight = num(context.start?.weightKg);
  if (startWeight && context.durationWeeks > 0) {
    const weeklyPercent =
      ((startWeight - input.actual.weightKg) / startWeight / context.durationWeeks) * 100;
    if (weeklyPercent > FAST_LOSS_WEEKLY_PERCENT) {
      warnings.push(
        "Khách giảm cân nhanh hơn khuyến nghị (trên 1% cân nặng mỗi tuần). HLV nên kiểm tra lại chế độ ăn và sức khỏe.",
      );
    }
  }

  const gaps = buildGaps({ input, components });
  return {
    total,
    breakdown,
    decision,
    nextPhaseKey: next.phaseKey,
    nextPhaseTitle: PHASE_META[next.phaseKey]?.phaseTitle || "",
    blockedReason: next.blockedReason,
    extendWeeks,
    gaps,
    pointsTo80: pointsNeeded(total, ADVANCE_THRESHOLD),
    pointsTo90: pointsNeeded(total, 90),
    warnings,
    safetyNote: safetyFlag ? safety.note || "" : "",
  };
};
