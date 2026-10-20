import { describe, expect, it } from "vitest";
import {
  buildExitCriteriaByPhase,
  buildObjectiveByPhase,
  buildExpectedChangesByPhase,
  buildGoalProgress,
  buildPersonalizedPath,
  determinePhaseCeiling,
  buildOutcomeTable,
  buildPhaseRoadmap,
  buildRecoveryFactor,
  estimatePhaseDuration,
  parseTimeframeWeeks,
} from "../f1Customer/resultPrediction.helpers.js";

const intakeOf = ({ goal = "fat_loss", training = {}, lifestyle = {}, body = {} } = {}) => ({
  bodyMetrics: {
    weightKg: 80,
    bodyFatPercent: 30,
    bmi: 27,
    waistCm: 92,
    hipCm: 104,
    restingHeartRate: 76,
    ...body,
  },
  lifestyleNutrition: lifestyle,
  trainingProfileGoal: {
    primaryGoal: goal,
    trainingDaysPerWeek: 3,
    ...training,
  },
  systemFlags: {},
});

const assessment = { overallPhysicalLevel: "below_average" };
const aiReport = { recommendations: { trainingFocus: [] }, findings: {} };

const table = (intake, path = ["phase_1", "phase_2"]) => {
  const phaseRoadmap = buildPhaseRoadmap({
    personalizedPath: path,
    intake,
    assessment,
    aiReport,
  });
  return {
    phaseRoadmap,
    outcome: buildOutcomeTable({
      intake,
      assessment,
      personalizedPath: path,
      phaseRoadmap,
    }),
  };
};

describe("parseTimeframeWeeks", () => {
  it("reads weeks, months and years written by a coach", () => {
    expect(parseTimeframeWeeks("12 tuần")).toBe(12);
    expect(parseTimeframeWeeks("3 tháng")).toBe(13);
    expect(parseTimeframeWeeks("6 tháng")).toBe(26.1);
    expect(parseTimeframeWeeks("1 năm")).toBe(52);
    expect(parseTimeframeWeeks("1,5 tháng")).toBe(6.5);
  });

  it("returns null when it cannot understand the text", () => {
    expect(parseTimeframeWeeks("")).toBeNull();
    expect(parseTimeframeWeeks("sớm nhất có thể")).toBeNull();
  });
});

describe("recovery factor and phase duration", () => {
  it("lowers the factor for poor sleep, high stress and few sessions", () => {
    const poor = buildRecoveryFactor(
      intakeOf({
        lifestyle: { sleepHours: 5, stressLevel: "high" },
        training: { trainingDaysPerWeek: 2 },
      }),
    );
    const steady = buildRecoveryFactor(
      intakeOf({ lifestyle: { sleepHours: 8 }, training: { trainingDaysPerWeek: 4 } }),
    );

    expect(poor).toBeLessThan(0.7);
    expect(steady).toBeGreaterThan(1);
  });

  it("makes a phase longer for 2 sessions a week and shorter for 4", () => {
    const base = { phaseKey: "phase_2", assessment, aiReport };
    const few = estimatePhaseDuration({
      ...base,
      intake: intakeOf({ training: { trainingDaysPerWeek: 2 } }),
    });
    const normal = estimatePhaseDuration({ ...base, intake: intakeOf() });
    const many = estimatePhaseDuration({
      ...base,
      intake: intakeOf({ training: { trainingDaysPerWeek: 5 } }),
    });

    expect(few).toBeGreaterThan(normal);
    expect(many).toBeLessThan(normal);
  });
});

describe("outcome table", () => {
  it("scales the fat-loss rate with body weight and gives ranges", () => {
    const heavy = table(intakeOf({ body: { weightKg: 100 } })).outcome;
    const light = table(intakeOf({ body: { weightKg: 55 } })).outcome;
    const lossOf = (outcome) =>
      Math.abs(outcome.phaseCheckpoints[0].deltaFromBaseline.weightKg);

    expect(lossOf(heavy)).toBeGreaterThan(lossOf(light));
    const range = heavy.phaseCheckpoints[0].projectedRange.weightKg;
    expect(range.min).toBeLessThan(range.max);
    expect(heavy.phaseCheckpoints[0].projected.weightKg).toBeGreaterThanOrEqual(
      range.min,
    );
    expect(heavy.phaseCheckpoints[0].projected.weightKg).toBeLessThanOrEqual(
      range.max,
    );
  });

  it("keeps weight flat for the maintenance goal", () => {
    const { outcome } = table(intakeOf({ goal: "maintenance" }));

    expect(outcome.phaseCheckpoints.at(-1).projected.weightKg).toBe(80);
  });

  it("slows fat loss when recovery is poor", () => {
    const steady = table(intakeOf()).outcome;
    const poor = table(
      intakeOf({ lifestyle: { sleepHours: 5, stressLevel: "high" } }),
    ).outcome;
    const finalWeight = (outcome) => outcome.phaseCheckpoints.at(-1).projected.weightKg;

    expect(finalWeight(poor)).toBeGreaterThan(finalWeight(steady));
  });
});

describe("goal progress", () => {
  it("compares the projection with the target weight and timeframe", () => {
    const intake = intakeOf({
      training: { targetWeightKg: 70, targetTimeframe: "3 tháng" },
    });
    const { outcome } = table(intake);
    const progress = outcome.goalProgress;

    expect(progress.targetWeightKg).toBe(70);
    expect(progress.timeframeWeeks).toBe(13);
    expect(progress.achievedPercent).toBeGreaterThan(0);
    expect(progress.achievedPercent).toBeLessThanOrEqual(100);
    expect(progress.summary).toContain("70 kg");
  });

  it("flags a timeframe that is too short for the target", () => {
    const intake = intakeOf({
      training: { targetWeightKg: 60, targetTimeframe: "4 tuần" },
    });
    const progress = table(intake).outcome.goalProgress;

    expect(progress.fitsTimeframe).toBe(false);
    expect(progress.summary).toContain("chưa kịp");
  });

  it("works without a target weight", () => {
    const progress = buildGoalProgress({
      intake: intakeOf({ training: { targetTimeframe: "6 tháng" } }),
      baseline: { weightKg: 80 },
      phaseCheckpoints: [{ durationWeeks: 14, projected: { weightKg: 76 } }],
    });

    expect(progress.achievedPercent).toBeNull();
    expect(progress.fitsTimeframe).toBe(true);
  });
});

describe("stage content for the heavy phases", () => {
  it("has its own expected changes and exit criteria for phase 4 and 5", () => {
    for (const phaseKey of ["phase_4", "phase_5"]) {
      const changes = buildExpectedChangesByPhase({ phaseKey, primaryGoal: "muscle_gain" });
      const exit = buildExitCriteriaByPhase(phaseKey);
      expect(changes).toHaveLength(3);
      expect(exit).toHaveLength(3);
      expect(changes.join(" ")).not.toContain("Tiếp tục cải thiện theo đúng mục tiêu");
      expect(exit.join(" ")).not.toContain("Đạt điều kiện để chuyển sang giai đoạn tiếp theo");
    }
  });
});

describe("phase ceiling for high-risk customers", () => {
  const withFlags = (flags) => ({ ...intakeOf(), systemFlags: flags });
  const ceilingFor = (flags, level) =>
    determinePhaseCeiling({
      intake: withFlags(flags),
      assessment: { overallPhysicalLevel: level },
      aiReport: { recommendations: { recommendedStartPhase: "phase_1" } },
    });

  it("stops at phase 1 for a low physical level with a medical flag or severe pain", () => {
    expect(ceilingFor({ medicalReviewFlag: true, painFlag: "none" }, "low")).toBe("phase_1");
    expect(ceilingFor({ medicalReviewFlag: false, painFlag: "severe" }, "low")).toBe("phase_1");
    expect(buildPersonalizedPath("phase_1", "phase_1")).toEqual(["phase_1"]);
  });

  it("keeps phase 2 when the level is not low or there is only moderate pain", () => {
    expect(ceilingFor({ medicalReviewFlag: true, painFlag: "none" }, "below_average")).toBe("phase_2");
    expect(ceilingFor({ medicalReviewFlag: false, painFlag: "moderate" }, "low")).toBe("phase_2");
    expect(ceilingFor({ testPermission: "modified_test" }, "average")).toBe("phase_2");
  });
});

describe("objective for the heavy phases", () => {
  it("has its own objective for phase 4 and 5 and keeps the generic one only for unknown phases", () => {
    const generic = "Tiếp tục cải thiện thể chất theo đúng giai đoạn phù hợp.";
    expect(buildObjectiveByPhase("phase_4", "muscle_gain")).toContain("sức mạnh tối đa");
    expect(buildObjectiveByPhase("phase_5", "muscle_gain")).toContain("bùng nổ");
    expect(buildObjectiveByPhase("phase_4", "muscle_gain")).not.toBe(generic);
    expect(buildObjectiveByPhase("phase_5", "fat_loss")).not.toBe(generic);
    expect(buildObjectiveByPhase("phase_9", "fat_loss")).toBe(generic);
  });
});
