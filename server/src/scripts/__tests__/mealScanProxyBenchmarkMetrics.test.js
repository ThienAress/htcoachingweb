import { describe, expect, test } from "vitest";

import {
  evaluateProxyChecks,
  scoreProxyCase,
  summarizeProxyBenchmark,
} from "../mealScanProxyBenchmarkMetrics.js";

const reference = {
  mealAliases: ["phở bò", "beef pho"],
  expectedScenario: "plated_meal",
  ingredientGroups: [
    { name: "bánh phở", aliases: ["bánh phở", "rice noodles"] },
    { name: "thịt bò", aliases: ["thịt bò", "beef"] },
    { name: "rau thơm", aliases: ["rau thơm", "herbs"] },
  ],
};

const prediction = {
  mealName: "Phở bò",
  confidence: "low",
  imageAssessment: { scenario: "plated_meal" },
  items: [
    { label: "Bánh phở" },
    { label: "Thịt bò thái lát" },
  ],
  questions: ["Bạn có thêm tương hoặc nước sốt không?"],
};

describe("mealScanProxyBenchmarkMetrics", () => {
  test("scores dish name and visible ingredient groups without macro fields", () => {
    expect(scoreProxyCase(prediction, reference)).toEqual({
      confidence: "low",
      predictedScenario: "plated_meal",
      scenarioMatched: true,
      dishMatched: true,
      ingredientHits: 2,
      ingredientTotal: 3,
      ingredientRecall: 0.6667,
      hiddenIngredientQuestion: true,
    });
  });

  test("summarizes provider and recognition signals", () => {
    const score = scoreProxyCase(prediction, reference);
    const summary = summarizeProxyBenchmark([
      { caseId: "pho-bo", success: true, score },
      { caseId: "bun-cha", success: false, errorCode: "TIMEOUT" },
    ]);

    expect(summary).toMatchObject({
      attempted: 2,
      successful: 1,
      providerSuccessRate: 0.5,
      mealNameAccuracy: 1,
      scenarioAccuracy: 1,
      meanIngredientRecall: 0.6667,
      hiddenIngredientQuestionRate: 1,
      confidenceCounts: { high: 0, medium: 0, low: 1 },
      failuresByCode: { TIMEOUT: 1 },
    });
  });

  test("keeps proxy checks informational even when thresholds pass", () => {
    expect(
      evaluateProxyChecks({
        successful: 8,
        providerSuccessRate: 1,
        mealNameAccuracy: 1,
        meanIngredientRecall: 0.8,
      }),
    ).toMatchObject({
      status: "INFORMATIONAL_PASS",
      passed: true,
      qualifiesNutritionAccuracy: false,
    });
  });

  test("recognizes Vietnamese condiment questions such as sa tế", () => {
    expect(
      scoreProxyCase(
        { ...prediction, questions: ["Bạn có thêm sa tế không?"] },
        reference,
      ).hiddenIngredientQuestion,
    ).toBe(true);
  });

  test("normalizes uppercase Vietnamese Đ and dessert uncertainty terms", () => {
    const score = scoreProxyCase(
      {
        ...prediction,
        items: [{ label: "Đế bánh pizza" }],
        questions: ["Bánh có dùng thêm bơ, kem hoặc đường không?"],
      },
      {
        mealAliases: ["phở bò"],
        ingredientGroups: [{
          name: "đế pizza",
          aliases: ["đế bánh pizza"],
        }],
      },
    );

    expect(score).toMatchObject({
      ingredientHits: 1,
      hiddenIngredientQuestion: true,
    });
  });

  test("reports scenario mismatch without turning proxy checks into a release gate", () => {
    const score = scoreProxyCase(
      {
        ...prediction,
        imageAssessment: { scenario: "shared_meal" },
      },
      reference,
    );

    expect(score).toMatchObject({
      predictedScenario: "shared_meal",
      scenarioMatched: false,
    });
    expect(
      summarizeProxyBenchmark([{ success: true, score }]).scenarioAccuracy,
    ).toBe(0);
  });
});
