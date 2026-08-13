import { describe, expect, it } from "vitest";

import { calculateTdee } from "../calculateTdee.tool.js";
import { executeTool, isSuccessfulToolResult } from "../toolEngine.js";

const completeParams = {
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  dailyMovement: "mostly_seated",
  steps: "under_5000",
  trainingFrequency: "five_plus",
  trainingDuration: "between_45_60",
  trainingIntensity: "moderate",
  goal: "fat_loss",
};

describe("calculate_tdee estimate contract", () => {
  it("fail closed khi provider chỉ gửi activityLevel mà thiếu bằng chứng cả ngày", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        gender: "male",
        age: 30,
        heightCm: 175,
        weightKg: 75,
        activityLevel: "moderate",
        goal: "fat_loss",
      },
      {},
    );

    expect(result.meta?.validationFailed).toBe(true);
  });

  it("trả recommendation band, khoảng estimate và hướng dẫn 14 ngày", async () => {
    const result = await calculateTdee(completeParams);

    expect(result.uiCard.data).toMatchObject({
      tdee: 2633,
      tdeeRange: { min: 2548, max: 2718 },
      activity: {
        key: "moderate",
        multiplier: 1.55,
        range: [1.5, 1.6],
      },
      calibrationDays: 14,
    });
    expect(result.text).toMatch(/ước tính/i);
    expect(result.text).toContain("14 ngày");
  });

  it("không chấp nhận activityLevel mâu thuẫn với recommendation", async () => {
    const result = await executeTool(
      "calculate_tdee",
      { ...completeParams, activityLevel: "active" },
      {},
    );

    expect(result.meta).toMatchObject({
      validationFailed: true,
      invalidFields: ["activityLevel"],
    });
    expect(isSuccessfulToolResult(result)).toBe(false);
  });

  it("fail closed khi adjustment hợp lệ theo schema nhưng đưa calo dưới ngưỡng", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        ...completeParams,
        gender: "female",
        age: 100,
        heightCm: 100,
        weightKg: 20,
        trainingFrequency: "none",
        trainingDuration: "none",
        trainingIntensity: "none",
        calorieAdjustment: -1500,
      },
      {},
    );

    expect(result.meta).toMatchObject({
      validationFailed: true,
      invalidFields: ["calorieAdjustment"],
    });
    expect(result.uiCard).toBeNull();
    expect(isSuccessfulToolResult(result)).toBe(false);
  });

  it("giữ calo và toàn bộ macro không âm ở adjustment thấp nhưng còn an toàn", async () => {
    const result = await calculateTdee({
      ...completeParams,
      calorieAdjustment: -1500,
    });

    expect(result.uiCard.data.targetCalories).toBe(1133);
    expect(
      Object.values(result.uiCard.data.macros).every((macro) =>
        Object.values(macro).every((grams) => grams >= 0),
      ),
    ).toBe(true);
  });

  it("derives sedentary for an explicit no-training state", async () => {
    const result = await calculateTdee({
      ...completeParams,
      trainingFrequency: "none",
      trainingDuration: "none",
      trainingIntensity: "none",
      goal: "maintenance",
    });

    expect(result.uiCard.data.activity).toMatchObject({
      key: "sedentary",
      multiplier: 1.2,
    });
  });

  it("rejects contradictory no-training evidence at runtime", async () => {
    await expect(
      calculateTdee({
        ...completeParams,
        trainingFrequency: "none",
        trainingDuration: "over_60",
        trainingIntensity: "vigorous",
      }),
    ).rejects.toThrow(/không nhất quán/i);
  });

  it("rejects contradictory no-training evidence before tool execution", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        ...completeParams,
        trainingFrequency: "none",
        trainingDuration: "over_60",
        trainingIntensity: "vigorous",
      },
      {},
    );

    expect(result.meta?.validationFailed).toBe(true);
    expect(result.uiCard).toBeNull();
  });
});
