// Dữ liệu nền cho đánh giá cuối giai đoạn: giai đoạn nào, bắt đầu từ số đo nào,
// dự kiến kết thúc ở đâu, lời khuyên nào cần kiểm lại và bài nào cần test lại.
// Giai đoạn 1 lấy từ bản dự đoán kết quả; giai đoạn sau lấy từ lần đánh giá trước.
import {
  translateCorrectiveFocus,
  translateTrainingFocus,
} from "./aiReport.helpers.js";
import { MAX_RECOMMENDATION_CHECKS, MAX_RETESTS } from "../../models/F1PhaseReview.js";

const METRICS = [
  ["strengthAssessment", "upperBodyPush", "Sức mạnh đẩy thân trên (Upper Push)"],
  ["strengthAssessment", "upperBodyPull", "Sức mạnh kéo thân trên (Upper Pull)"],
  ["strengthAssessment", "lowerBody", "Sức mạnh thân dưới (Lower Body)"],
  ["strengthAssessment", "coreStrength", "Sức mạnh cơ lõi (Core)"],
  ["enduranceAssessment", "muscularEndurance", "Sức bền cơ bắp (Muscular Endurance)"],
  ["enduranceAssessment", "coreEndurance", "Sức bền cơ lõi (Core Endurance)"],
  ["cardioAssessment", "cardioCapacity", "Năng lực tim mạch (Cardio Capacity)"],
  ["cardioAssessment", "recoveryHeartRate", "Hồi phục nhịp tim (Heart Rate Recovery)"],
];
export const METRIC_KEYS = new Set(METRICS.map(([, key]) => key));
const DEFAULT_SESSIONS_PER_WEEK = 3;

const capitalize = (text = "") => (text ? text[0].toUpperCase() + text.slice(1) : text);
const plain = (doc) => (doc?.toObject ? doc.toObject() : doc || {});

const buildFirstRecommendations = (aiReport) => {
  const rec = aiReport?.recommendations || {};
  const items = [
    ...translateCorrectiveFocus((rec.correctiveFocus || []).slice(0, 3)),
    ...(rec.trainingNotes || []).slice(0, 3),
    ...translateTrainingFocus((rec.trainingFocus || []).slice(0, 2)),
  ]
    .map((text) => capitalize(String(text || "").trim()).slice(0, 300))
    .filter(Boolean);
  return [...new Set(items)].slice(0, MAX_RECOMMENDATION_CHECKS);
};

// Bài tim mạch nhập một kết quả duy nhất; các bài còn lại theo hiệp × lần hoặc hiệp × giây.
const RESULT_KINDS = {
  cardioCapacity: "minutes",
  recoveryHeartRate: "hr_drop",
};

const detectInputMode = (exercise) => {
  if (exercise.inputMode) return exercise.inputMode;
  if (Number(exercise.durationSec) > 0) return "time";
  if (Number(exercise.reps) > 0) return "reps";
  return "";
};

const buildFirstRetests = (assessment) => {
  const items = [];
  for (const [group, key, label] of METRICS) {
    for (const exercise of assessment?.[group]?.[key]?.exercises || []) {
      if (!exercise?.name) continue;
      items.push({
        metricKey: key,
        metricLabel: label,
        name: exercise.name,
        tier: exercise.tier || "",
        inputMode: detectInputMode(exercise),
        resultKind: RESULT_KINDS[key] || "",
        selectedProtocol: exercise.selectedProtocol || null,
        previousLevel: exercise.level || "",
        previous: {
          sets: exercise.sets ?? null,
          reps: exercise.reps ?? null,
          durationSec: exercise.durationSec ?? null,
          result: exercise.result ?? null,
        },
      });
    }
  }
  return items.slice(0, MAX_RETESTS);
};

const VIEW_KEYS = ["anterior", "lateral", "posterior"];

// Các biểu hiện sai cần kiểm lại: lấy từ lần đánh giá ban đầu (mã) hoặc từ lần đánh giá trước (nhãn).
const buildOhsaItems = (assessment) =>
  VIEW_KEYS.flatMap((view) =>
    (assessment?.movementAssessment?.overheadSquat?.[view] || []).map((code) => ({
      view,
      key: String(code),
      label: "",
    })),
  );

const buildOhsaBaseline = (assessment) => {
  const squat = assessment?.movementAssessment?.overheadSquat || {};
  const view = (key) => ((squat[key] || []).length ? true : squat[`${key}Normal`] ? false : null);
  return {
    anteriorIssue: view("anterior"),
    lateralIssue: view("lateral"),
    posteriorIssue: view("posterior"),
  };
};

// `reviews` là các lần đánh giá trước của cùng bản dự đoán, sắp theo stageOrder.
export const buildStageContext = ({ stageOrder, prediction, intake, assessment, aiReport, reviews = [] }) => {
  const training = intake?.trainingProfileGoal || {};
  const shared = {
    stageOrder,
    primaryGoal: training.primaryGoal || "",
    targetWeightKg: Number(training.targetWeightKg || 0) || null,
    heightCm: Number(intake?.bodyMetrics?.heightCm || 0) || null,
    originalWeightKg: Number(prediction?.outcomeTable?.baseline?.weightKg || 0) || null,
  };
  const sessionsPerWeek =
    Number(training.trainingDaysPerWeek || 0) || DEFAULT_SESSIONS_PER_WEEK;

  if (stageOrder === 1) {
    const stage = prediction?.phaseRoadmap?.[0];
    if (!stage) return null;
    const durationWeeks = Number(stage.durationWeeks || 0);
    return {
      ...shared,
      phaseKey: stage.phaseKey,
      durationWeeks,
      weeksBefore: 0,
      start: plain(prediction.outcomeTable?.baseline),
      projected: plain(prediction.outcomeTable?.phaseCheckpoints?.[0]?.projected),
      plannedSessions: Math.max(1, Math.round((Number(stage.weeklySchedule?.sessionsPerWeek) || sessionsPerWeek) * durationWeeks)),
      recommendations: buildFirstRecommendations(aiReport),
      retests: buildFirstRetests(assessment),
      ohsaBaseline: buildOhsaBaseline(assessment),
      ohsaItems: buildOhsaItems(assessment),
    };
  }

  const previous = reviews.find((item) => item.stageOrder === stageOrder - 1);
  if (!previous?.nextPhasePlan?.phaseKey) return null;
  const plan = previous.nextPhasePlan;
  const durationWeeks = Number(plan.durationWeeks || 0);
  const weeksBefore = reviews
    .filter((item) => item.stageOrder < stageOrder)
    .reduce((sum, item) => sum + Number(item.evaluation?.stageWeeks || 0), 0);
  return {
    ...shared,
    phaseKey: plan.phaseKey,
    durationWeeks,
    weeksBefore,
    start: plain(previous.nextOutcome?.baseline),
    projected: plain(previous.nextOutcome?.checkpoint?.projected),
    plannedSessions: Math.max(1, Math.round((Number(plan.weeklySchedule?.sessionsPerWeek) || sessionsPerWeek) * durationWeeks)),
    recommendations: (plan.carryOver || []).slice(0, MAX_RECOMMENDATION_CHECKS),
    retests: (previous.retests || []).map((item) => {
      const original = buildFirstRetests(assessment).find(
        (base) => base.metricKey === item.metricKey && base.name === item.name,
      );
      return {
        metricKey: item.metricKey,
        metricLabel: METRICS.find(([, key]) => key === item.metricKey)?.[2] || "",
        name: item.name,
        tier: item.tier || "",
        inputMode: original?.inputMode || "",
        resultKind: original?.resultKind || RESULT_KINDS[item.metricKey] || "",
        selectedProtocol: original?.selectedProtocol || null,
        previousLevel: item.level || item.previousLevel || "",
        previous: {
          sets: item.sets ?? null,
          reps: item.reps ?? null,
          durationSec: item.durationSec ?? null,
          result: item.result ?? null,
        },
      };
    }),
    ohsaItems: (previous.ohsa?.items || [])
      .filter((item) => item.status !== "resolved")
      .map((item) => ({ view: item.view, key: item.key || item.label, label: item.label })),
    ohsaBaseline: {
      anteriorIssue: Boolean(previous.ohsa?.anteriorIssue),
      lateralIssue: Boolean(previous.ohsa?.lateralIssue),
      posteriorIssue: Boolean(previous.ohsa?.posteriorIssue),
    },
  };
};
