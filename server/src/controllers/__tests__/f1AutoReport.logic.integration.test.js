import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import F1AiRule from "../../models/F1AiRule.js";
import { buildAiReport } from "../f1Customer/aiReport.helpers.js";

const metric = (level, score, exercises = []) => ({ level, score, exercises });
const tested = (name, tier, level) => ({ name, tier, level, source: "system" });

const goodAssessment = (overrides = {}) => ({
  overallPhysicalLevel: "good",
  postureAssessment: {},
  movementAssessment: {
    overheadSquat: { anterior: [], lateral: [], posterior: [] },
  },
  strengthAssessment: {
    upperBodyPush: metric("good", 9),
    upperBodyPull: metric("good", 9),
    lowerBody: metric("good", 9),
    coreStrength: metric("good", 9),
  },
  enduranceAssessment: {
    muscularEndurance: metric("good", 9),
    coreEndurance: metric("good", 9),
  },
  cardioAssessment: {
    restingHeartRate: 62,
    cardioCapacity: metric("good", 9),
    recoveryHeartRate: metric("good", 9),
  },
  ...overrides,
});

const experiencedIntake = (health = {}) => ({
  systemFlags: { painFlag: "none" },
  healthScreening: { warningSigns: [], ...health },
  lifestyleNutrition: {},
  trainingProfileGoal: {
    primaryGoal: "muscle_gain",
    trainingExperience: "advanced",
    currentlyTraining: true,
    trainingDaysPerWeek: 4,
  },
});

const readyCustomer = { readinessStatus: "ready" };

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("automatic report: phase decision and reasons", () => {
  it("puts a ready, strong customer without history into phase 3 and says why", async () => {
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake(),
      assessment: goodAssessment(),
    });

    expect(report.recommendations.recommendedStartPhase).toBe("phase_3");
    expect(report.recommendations.reasons.length).toBeGreaterThan(0);
    expect(report.engineVersion).toBe("nasm-rule-engine-v4");
  });

  it("holds the customer for review when there are warning signs", async () => {
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake({ warningSigns: ["dizziness"] }),
      assessment: goodAssessment(),
    });

    expect(report.recommendations.recommendedStartPhase).toBe("pending_review");
    expect(report.recommendations.reasons.join(" ")).toContain("cảnh báo");
  });

  it("caps phase 3 at phase 2 for injury history and adds a safety note", async () => {
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake({ injuries: "Trật vai phải" }),
      assessment: goodAssessment(),
    });

    expect(report.findings.riskFlags).toContain("injury_history");
    expect(report.recommendations.recommendedStartPhase).toBe("phase_2");
    expect(
      report.recommendations.trainingNotes.some((note) =>
        note.includes("Trật vai phải"),
      ),
    ).toBe(true);
  });

  it("drops to phase 1 when two cards stay weak even at the easy tier", async () => {
    const weakEasy = (name) =>
      metric("below_average", 4.5, [tested(name, "easy", "below_average")]);
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake(),
      assessment: goodAssessment({
        overallPhysicalLevel: "average",
        strengthAssessment: {
          upperBodyPush: weakEasy("Wall Push-Up"),
          upperBodyPull: weakEasy("Band Row"),
          lowerBody: metric("good", 9),
          coreStrength: metric("good", 9),
        },
      }),
    });

    expect(report.recommendations.recommendedStartPhase).toBe("phase_1");
    expect(report.recommendations.reasons.join(" ")).toContain("mức dễ");
  });
});

describe("automatic report: evidence and rules", () => {
  it("lists tested exercises with tier and level, and unassessed squat views", async () => {
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake(),
      assessment: goodAssessment({
        movementAssessment: {
          overheadSquat: {
            anterior: [],
            lateral: ["low_back_arch"],
            posterior: [],
            anteriorNormal: true,
          },
        },
        strengthAssessment: {
          upperBodyPush: metric("good", 9, [
            tested("Wall Push-Up", "easy", "good"),
          ]),
          upperBodyPull: metric("good", 9),
          lowerBody: metric("good", 9),
          coreStrength: metric("good", 9),
        },
      }),
    });

    const lines = report.findings.testedExercises.join("\n");
    expect(lines).toContain("Wall Push-Up (mức dễ, Tốt)");
    expect(lines).toContain("mặt trước: không có biểu hiện sai");
    expect(lines).toContain("mặt bên: có biểu hiện sai");
    expect(lines).toContain("mặt sau: chưa đánh giá");
  });

  it("does not fall back to built-in notes when active rules exist but none match", async () => {
    await F1AiRule.create({
      code: "NEVER_MATCHES",
      name: "Luật không bao giờ khớp",
      category: "other",
      isActive: true,
      conditions: [
        { field: "customer.fullName", operator: "EQUals", value: "__none__" },
      ],
      recommendation: { content: "Ghi chú không được xuất hiện" },
    });

    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake(),
      assessment: goodAssessment(),
    });

    expect(report.recommendations.trainingNotes).toEqual([]);
  });

  it("keeps the built-in notes when no rule is active", async () => {
    const report = await buildAiReport({
      customer: readyCustomer,
      intake: experiencedIntake(),
      assessment: goodAssessment(),
    });

    expect(report.recommendations.trainingNotes.length).toBeGreaterThan(0);
    const text = report.recommendations.trainingNotes.join(" ");
    expect(text).not.toMatch(/\b(volume|recovery|stress)\b/i);
  });
});
