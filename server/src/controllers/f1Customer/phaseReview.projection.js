// Đề xuất và dự đoán giai đoạn kế tiếp, bắt đầu từ số đo thực tế cuối giai đoạn trước.
//
// Cơ sở:
// - Mục tiêu ban đầu khoảng 10% cân nặng trong ~6 tháng, sau đó ưu tiên giữ cân (NHLBI):
//   https://www.nhlbi.nih.gov/health/educational/lose_wt/guidelines.htm
// - Giảm cân chậm dần do cơ thể thích nghi (Hall và cộng sự, Lancet 2011):
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593
// - Nhịp tim nghỉ giảm nhiều hơn khi nhịp ban đầu cao (Reimers và cộng sự, 2018):
//   https://www.mdpi.com/2077-0383/7/12/503/htm
import {
  PHASE_META,
  buildExitCriteriaByPhase,
  buildExpectedChangesByPhase,
  buildGoalProgress,
  buildObjectiveByPhase,
  buildProjectedRange,
  estimatePhaseDuration,
  projectFatLossPhase,
  projectMaintenancePhase,
  projectMuscleGainPhase,
} from "./resultPrediction.helpers.js";

export const NHLBI_LOSS_PERCENT = 10;
export const NHLBI_LOSS_WEEKS = 26;
const MIN_BMI = 18.5;
const ADAPTATION_PER_STAGE = 0.9;
const MAX_CARRY_OVER = 4;
const LEVEL_ORDER = ["low", "below_average", "average", "good"];

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const round1 = (num) => Math.round(Number(num || 0) * 10) / 10;
const formatPercent = (value) => String(value).replace(".", ",");
const num = (value) =>
  value === null || value === undefined || value === "" ? null : Number(value);

const stepLevel = (level, steps) => {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx < 0) return level || "average";
  return LEVEL_ORDER[clamp(idx + steps, 0, LEVEL_ORDER.length - 1)];
};

// Hệ số đáp ứng: tốc độ giảm thực / dự kiến, kẹp 0,6–1,15 rồi kéo về 1 một nửa
// để không suy diễn quá đà từ một lần đo.
export const buildResponseFactor = ({ start = {}, projected = {}, actual }) => {
  const startWeight = num(start.weightKg);
  const projectedWeight = num(projected.weightKg);
  if (!startWeight || projectedWeight === null) return 1;
  const expected = startWeight - projectedWeight;
  if (Math.abs(expected) < 0.1) return 1;
  const ratio = clamp((startWeight - actual.weightKg) / expected, 0.6, 1.15);
  return round1((1 + ratio) / 2 * 100) / 100;
};

const buildLifestyleFactor = (adherence = {}) => {
  let factor = 1;
  if (adherence.sleep === "poor") factor -= 0.15;
  if (adherence.nutrition === "poor") factor -= 0.1;
  return factor;
};

const buildStartMetrics = ({ actual, heightCm, previousLevel, evaluation }) => {
  const height = num(heightCm);
  return {
    label: "Đầu giai đoạn",
    weightKg: actual.weightKg,
    bodyFatPercent: num(actual.bodyFatPercent),
    bmi: height ? round1(actual.weightKg / (height / 100) ** 2) : null,
    waistCm: num(actual.waistCm),
    hipCm: num(actual.hipCm),
    restingHeartRate: num(actual.restingHeartRate),
    overallPhysicalLevel: stepLevel(previousLevel, evaluation.total >= 80 ? 1 : 0),
  };
};

// Chọn cách dự đoán theo mục tiêu; giảm mỡ chuyển sang giữ cân khi đã chạm mốc NHLBI
// hoặc đã tới cân nặng mục tiêu.
const pickProjection = ({ primaryGoal, originalWeightKg, actualWeightKg, fatLossWeeks, targetWeightKg }) => {
  if (primaryGoal === "maintenance") return { mode: "maintenance", note: "" };
  if (primaryGoal !== "fat_loss") return { mode: "gain", note: "" };
  const lossPercent = originalWeightKg
    ? ((originalWeightKg - actualWeightKg) / originalWeightKg) * 100
    : 0;
  if (targetWeightKg && actualWeightKg <= targetWeightKg) {
    return { mode: "maintenance", note: "Khách đã đạt cân nặng mục tiêu; giai đoạn này ưu tiên giữ cân và cải thiện thể lực." };
  }
  if (lossPercent >= NHLBI_LOSS_PERCENT || fatLossWeeks >= NHLBI_LOSS_WEEKS) {
    return {
      mode: "maintenance",
      note: `Khách đã giảm ${formatPercent(round1(lossPercent))}% cân nặng sau ${fatLossWeeks} tuần. Theo khuyến nghị, giai đoạn này ưu tiên giữ cân. Muốn giảm tiếp, khách trao đổi trực tiếp với HLV.`,
    };
  }
  return { mode: "fat_loss", note: "" };
};

const limitWeight = ({ projected, start, targetWeightKg, heightCm }) => {
  const height = num(heightCm);
  const floors = [num(targetWeightKg), height ? MIN_BMI * (height / 100) ** 2 : null]
    .filter((value) => value !== null && value < start.weightKg);
  const floor = floors.length ? Math.max(...floors) : null;
  if (floor === null || projected.weightKg === null || projected.weightKg >= floor) return projected;
  const ratio = (start.weightKg - floor) / Math.max(start.weightKg - projected.weightKg, 0.01);
  const scaleDelta = (key) =>
    projected[key] === null || start[key] === null
      ? projected[key]
      : round1(start[key] + (projected[key] - start[key]) * ratio);
  return {
    ...projected,
    weightKg: round1(floor),
    bodyFatPercent: scaleDelta("bodyFatPercent"),
    bmi: scaleDelta("bmi"),
    waistCm: scaleDelta("waistCm"),
    hipCm: scaleDelta("hipCm"),
  };
};

// Nhịp tim nghỉ càng gần 60 bpm thì càng khó giảm thêm; không xuống dưới 55.
const softenHeartRate = (projected, start) => {
  if (projected.restingHeartRate === null || start.restingHeartRate === null) return projected;
  const scale = clamp((start.restingHeartRate - 60) / 20, 0.25, 1);
  const delta = (start.restingHeartRate - projected.restingHeartRate) * scale;
  return { ...projected, restingHeartRate: Math.max(55, round1(start.restingHeartRate - delta)) };
};

const buildDelta = (start, projected) =>
  Object.fromEntries(
    ["weightKg", "bodyFatPercent", "bmi", "waistCm", "hipCm", "restingHeartRate"].map((key) => [
      key,
      start[key] !== null && projected[key] !== null ? round1(projected[key] - start[key]) : null,
    ]),
  );

const buildEntryReason = ({ evaluation, currentPhaseKey }) => {
  const current = PHASE_META[currentPhaseKey]?.phaseTitle || "";
  if (evaluation.decision === "coach_review") {
    return "Khách báo đau, chấn thương hoặc dấu hiệu cảnh báo mới. Hệ thống giữ giai đoạn hiện tại; HLV kiểm tra và quyết định bước tiếp theo.";
  }
  if (evaluation.decision === "extend") {
    return `Khách đạt ${formatPercent(evaluation.total)}% (cần 80% để chuyển). Tiếp tục ${current} thêm ${evaluation.extendWeeks} tuần, tập trung vào các mục chưa đạt rồi đánh giá lại.`;
  }
  if (evaluation.decision === "repeat") {
    return `Khách đạt ${formatPercent(evaluation.total)}% (dưới 60%). Lặp lại ${current}; HLV nên tìm hiểu điều gì cản trở khách tập đều và làm theo lời khuyên.`;
  }
  if (evaluation.blockedReason) return evaluation.blockedReason;
  if (evaluation.nextPhaseKey === currentPhaseKey) {
    return `Khách đạt ${formatPercent(evaluation.total)}% và tiếp tục một chu kỳ mới của ${current} với mức tải cao hơn.`;
  }
  return `Khách đạt ${formatPercent(evaluation.total)}% (ngưỡng chuyển là 80%), đủ điều kiện chuyển sang ${evaluation.nextPhaseTitle}.`;
};

const buildCarryOver = ({ input }) => {
  const items = (input.recommendationChecks || [])
    .filter((item) => item.status !== "met")
    .map((item) => item.text);
  const ohsaLabels = { anteriorIssue: "mặt trước", lateralIssue: "mặt bên", posteriorIssue: "mặt sau" };
  const views = Object.entries(ohsaLabels)
    .filter(([key]) => input.ohsa?.[key])
    .map(([, label]) => label);
  if (views.length) items.push(`Tiếp tục chỉnh biểu hiện sai khi squat ở ${views.join(", ")}`);
  return items.slice(0, MAX_CARRY_OVER);
};

export const buildNextStage = ({ input, context, evaluation, intake, assessment, aiReport }) => {
  const primaryGoal = context.primaryGoal;
  const phaseKey = evaluation.nextPhaseKey;
  const durationWeeks =
    evaluation.decision === "extend"
      ? evaluation.extendWeeks
      : estimatePhaseDuration({ phaseKey, intake, assessment, aiReport });
  const start = buildStartMetrics({
    actual: input.actual,
    heightCm: context.heightCm,
    previousLevel: context.start?.overallPhysicalLevel,
    evaluation,
  });
  const fatLossWeeks = context.weeksBefore + context.durationWeeks;
  const projection = pickProjection({
    primaryGoal,
    originalWeightKg: context.originalWeightKg,
    actualWeightKg: input.actual.weightKg,
    fatLossWeeks,
    targetWeightKg: context.targetWeightKg,
  });
  const factor = clamp(
    buildResponseFactor({ start: context.start, projected: context.projected, actual: input.actual }) *
      buildLifestyleFactor(input.adherence) *
      ADAPTATION_PER_STAGE ** context.stageOrder,
    0.5,
    1.15,
  );
  const project =
    projection.mode === "fat_loss"
      ? projectFatLossPhase
      : projection.mode === "maintenance"
        ? projectMaintenancePhase
        : projectMuscleGainPhase;
  let projected = project({ phaseKey, weeks: durationWeeks, current: start, factor });
  if (projection.mode === "fat_loss") {
    projected = limitWeight({ projected, start, targetWeightKg: context.targetWeightKg, heightCm: context.heightCm });
  }
  projected = softenHeartRate(projected, start);

  const checkpoint = {
    phaseKey,
    label: `Kết thúc giai đoạn ${context.stageOrder + 1}`,
    durationWeeks,
    projected,
    projectedRange: buildProjectedRange({ baseline: start, projected, stageIndex: context.stageOrder }),
    deltaFromBaseline: buildDelta(start, projected),
  };

  return {
    nextPhasePlan: {
      stageOrder: context.stageOrder + 1,
      phaseKey,
      phaseTitle: PHASE_META[phaseKey]?.phaseTitle || "",
      levelTitle: PHASE_META[phaseKey]?.levelTitle || "",
      durationWeeks,
      objective: buildObjectiveByPhase(phaseKey, primaryGoal),
      entryReason: buildEntryReason({ evaluation, currentPhaseKey: context.phaseKey }),
      keyFocus: (aiReport?.recommendations?.trainingFocus || []).slice(0, 4),
      expectedChanges: buildExpectedChangesByPhase({ phaseKey, primaryGoal }),
      exitCriteria: buildExitCriteriaByPhase(phaseKey),
      carryOver: buildCarryOver({ input }),
    },
    nextOutcome: {
      baseline: start,
      checkpoint,
      projectionMode: projection.mode,
      projectionNote: projection.note,
      responseFactor: round1(factor * 100) / 100,
      goalProgress: buildGoalProgress({ intake, baseline: start, phaseCheckpoints: [checkpoint] }),
    },
  };
};
