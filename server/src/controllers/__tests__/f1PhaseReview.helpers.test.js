import { describe, expect, it } from "vitest";
import { evaluatePhaseReview, scoreRetest } from "../f1Customer/phaseReview.scoring.js";
import { buildNextStage, buildResponseFactor } from "../f1Customer/phaseReview.projection.js";

const retest = (previousLevel, level, name = "Goblet Squat") => ({
  metricKey: "lowerBody",
  name,
  previousLevel,
  level,
});

const allMet = (count) =>
  Array.from({ length: count }, (_, idx) => ({ text: `Lời khuyên ${idx + 1}`, status: "met" }));

// Khách duy trì cân, mọi thành phần khác đạt tối đa: tổng = 80 + 0,2 × số buổi đã tập (trên 100).
const maintenanceInput = ({ completed, checks = allMet(10), ohsa = {}, safety = {} }) => ({
  actual: { weightKg: 60 },
  adherence: { plannedSessions: 100, completedSessions: completed, nutrition: "good", sleep: "good" },
  recommendationChecks: checks,
  retests: [retest("average", "good")],
  ohsa,
  safety,
});
const maintenanceContext = {
  primaryGoal: "maintenance",
  phaseKey: "phase_2",
  durationWeeks: 10,
  start: { weightKg: 60 },
  projected: { weightKg: 60 },
};
const evaluateMaintenance = (options) =>
  evaluatePhaseReview({ input: maintenanceInput(options), context: maintenanceContext });

describe("scoreRetest", () => {
  it("rewards moving up a level or holding Tốt", () => {
    expect(scoreRetest(retest("below_average", "average"))).toBe(1);
    expect(scoreRetest(retest("good", "good"))).toBe(1);
    expect(scoreRetest(retest("average", "average"))).toBe(0.6);
    expect(scoreRetest(retest("good", "average"))).toBe(0);
    expect(scoreRetest(retest("average", ""))).toBeNull();
  });
});

describe("evaluatePhaseReview: worked fat-loss example", () => {
  const result = evaluatePhaseReview({
    context: {
      primaryGoal: "fat_loss",
      phaseKey: "phase_2",
      durationWeeks: 11,
      start: { weightKg: 75, waistCm: 88 },
      projected: { weightKg: 71.2, waistCm: 84 },
    },
    input: {
      actual: { weightKg: 71.8, waistCm: 85 },
      adherence: { plannedSessions: 33, completedSessions: 30, nutrition: "fair", sleep: "poor" },
      recommendationChecks: [
        { text: "Chỉnh ưỡn lưng khi squat", status: "met" },
        { text: "Tăng sức mạnh thân dưới", status: "met" },
        { text: "Giảm ăn ngoài còn 2 bữa/tuần", status: "partial" },
        { text: "Ngủ đủ 7 giờ", status: "not_met" },
      ],
      retests: [
        retest("below_average", "good", "Incline Push-Up"),
        retest("good", "good", "Band Row"),
        retest("average", "good", "Goblet Squat"),
        retest("average", "average", "Front Plank Hold"),
      ],
      ohsa: { lateralIssue: true },
      safety: {},
    },
  });

  it("scores each component and advances to Hypertrophy", () => {
    // 30/33 buổi = 18,2; lời khuyên (1+1+0,5+0)/4 = 12,5; test lại 0,9 × 30 = 27;
    // squat 2/3 góc = 6,7; cơ thể (cân 100%, eo 0,75/0,8) = 19,4 → 83,7%.
    expect(result.breakdown).toEqual({
      sessions: { points: 18.2, max: 20 },
      advice: { points: 12.5, max: 20 },
      retest: { points: 27, max: 30 },
      ohsa: { points: 6.7, max: 10 },
      body: { points: 19.4, max: 20 },
    });
    expect(result.total).toBe(83.7);
    expect(result.decision).toBe("advance");
    expect(result.nextPhaseKey).toBe("phase_3");
    expect(result.pointsTo80).toBe(0);
    expect(result.pointsTo90).toBe(6.3);
    expect(result.warnings).toEqual([]);
  });

  it("ranks the gaps by the points they would add", () => {
    expect(result.gaps.map((gap) => gap.points)).toEqual([5, 3.3, 3, 2.5, 1.8, 0.6]);
    expect(result.gaps[0].text).toBe("Ngủ đủ 7 giờ");
    expect(result.gaps[2].text).toBe("Front Plank Hold: đạt mức Tốt");
  });
});

describe("evaluatePhaseReview: thresholds and gates", () => {
  const oneParial = [...allMet(9), { text: "Lời khuyên 10", status: "partial" }];
  const noneMet = allMet(10).map((item) => ({ ...item, status: "not_met" }));

  it("advances at exactly 80% and extends just below", () => {
    expect(evaluateMaintenance({ completed: 0 })).toMatchObject({ total: 80, decision: "advance" });
    expect(evaluateMaintenance({ completed: 4, checks: oneParial })).toMatchObject({
      total: 79.8,
      decision: "extend",
      extendWeeks: 2,
    });
  });

  it("extends at exactly 60% and repeats just below", () => {
    expect(evaluateMaintenance({ completed: 0, checks: noneMet })).toMatchObject({
      total: 60,
      decision: "extend",
      extendWeeks: 4,
    });
    expect(
      evaluateMaintenance({ completed: 16, checks: noneMet, ohsa: { anteriorIssue: true } }),
    ).toMatchObject({ total: 59.9, decision: "repeat" });
  });

  it("sends new pain to the coach regardless of the score", () => {
    const result = evaluateMaintenance({
      completed: 100,
      safety: { newPain: true, note: "Đau gối phải" },
    });
    expect(result.total).toBe(100);
    expect(result.decision).toBe("coach_review");
    expect(result.nextPhaseKey).toBe("phase_2");
    expect(result.safetyNote).toBe("Đau gối phải");
  });

  it("keeps phase 2 when the squat still compensates in two views", () => {
    const result = evaluateMaintenance({
      completed: 100,
      ohsa: { anteriorIssue: true, lateralIssue: true },
    });
    expect(result.decision).toBe("advance");
    expect(result.nextPhaseKey).toBe("phase_2");
    expect(result.blockedReason).toContain("2 góc nhìn");
  });

  it("warns when weight drops faster than 1% a week", () => {
    const result = evaluatePhaseReview({
      input: { ...maintenanceInput({ completed: 100 }), actual: { weightKg: 52 } },
      context: { ...maintenanceContext, primaryGoal: "fat_loss", projected: { weightKg: 56 } },
    });
    expect(result.warnings[0]).toContain("nhanh hơn khuyến nghị");
  });
});

describe("buildNextStage", () => {
  const intake = {
    bodyMetrics: { heightCm: 160 },
    trainingProfileGoal: { primaryGoal: "fat_loss", trainingDaysPerWeek: 3 },
  };
  const evaluation = { total: 84, decision: "advance", nextPhaseKey: "phase_3", nextPhaseTitle: "Hypertrophy", extendWeeks: 0, blockedReason: "" };
  const baseContext = {
    stageOrder: 1,
    primaryGoal: "fat_loss",
    phaseKey: "phase_2",
    durationWeeks: 11,
    weeksBefore: 0,
    heightCm: 160,
    targetWeightKg: null,
    originalWeightKg: 75,
    start: { weightKg: 75, waistCm: 88, restingHeartRate: 82, overallPhysicalLevel: "below_average" },
    projected: { weightKg: 71.2, waistCm: 84 },
  };
  const input = (actual, adherence = {}) => ({
    actual,
    adherence: { nutrition: "good", sleep: "good", ...adherence },
    recommendationChecks: [{ text: "Ngủ đủ 7 giờ", status: "not_met" }],
    ohsa: { lateralIssue: true },
  });
  const build = (context, actual, adherence) =>
    buildNextStage({ input: input(actual, adherence), context, evaluation, intake, assessment: {}, aiReport: {} });

  it("starts the next stage from the measured values and keeps losing weight", () => {
    const { nextPhasePlan, nextOutcome } = build(baseContext, { weightKg: 71.8, waistCm: 85, restingHeartRate: 79 });

    expect(nextPhasePlan).toMatchObject({ stageOrder: 2, phaseKey: "phase_3", durationWeeks: 10 });
    expect(nextPhasePlan.carryOver).toEqual([
      "Ngủ đủ 7 giờ",
      "Tiếp tục chỉnh biểu hiện sai khi squat ở mặt bên",
    ]);
    expect(nextOutcome.baseline).toMatchObject({ weightKg: 71.8, bmi: 28, overallPhysicalLevel: "average" });
    expect(nextOutcome.projectionMode).toBe("fat_loss");
    expect(nextOutcome.checkpoint.projected.weightKg).toBeLessThan(71.8);
    expect(nextOutcome.checkpoint.projected.weightKg).toBeGreaterThan(69);
  });

  it("switches to weight maintenance after about 10% loss (NHLBI)", () => {
    const { nextOutcome } = build({ ...baseContext, originalWeightKg: 80 }, { weightKg: 71.5 });
    expect(nextOutcome.projectionMode).toBe("maintenance");
    expect(nextOutcome.checkpoint.projected.weightKg).toBe(71.5);
    expect(nextOutcome.projectionNote).toContain("trao đổi trực tiếp với HLV");
  });

  it("does not project below the target weight", () => {
    const { nextOutcome } = build({ ...baseContext, targetWeightKg: 71 }, { weightKg: 71.8 });
    expect(nextOutcome.checkpoint.projected.weightKg).toBe(71);
  });

  it("slows the resting heart rate drop near 60 bpm and never goes under 55", () => {
    const { nextOutcome } = build(baseContext, { weightKg: 71.8, restingHeartRate: 58 });
    const rhr = nextOutcome.checkpoint.projected.restingHeartRate;
    expect(rhr).toBeGreaterThanOrEqual(55);
    expect(rhr).toBeGreaterThan(57);
  });
});

describe("buildResponseFactor", () => {
  it("pulls a slow responder halfway back towards 1", () => {
    // Dự kiến giảm 4 kg, thực tế 2 kg → tỷ lệ 0,5 → kẹp 0,6 → (1 + 0,6) / 2 = 0,8.
    expect(
      buildResponseFactor({ start: { weightKg: 75 }, projected: { weightKg: 71 }, actual: { weightKg: 73 } }),
    ).toBe(0.8);
  });
});
