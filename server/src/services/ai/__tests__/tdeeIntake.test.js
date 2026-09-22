import { describe, expect, it } from "vitest";

import {
  buildTdeeIntakeResponse,
  extractTdeePrefill,
  getMissingTdeeInputFields,
} from "../tdeeIntake.js";

describe("TDEE structured intake", () => {
  it("prefills only facts explicitly provided by the user", () => {
    const prefill = extractTdeePrefill(
      "Tôi là nam, 28 tuổi, 1 tuần tập 3-4 buổi, tính giúp tôi TDEE",
    );

    expect(prefill).toEqual({
      gender: "male",
      age: 28,
      trainingFrequency: "three_four",
    });
    expect(prefill).not.toHaveProperty("activityLevel");
    expect(getMissingTdeeInputFields(prefill)).toEqual(
      expect.arrayContaining([
        "heightCm",
        "weightKg",
        "dailyMovement",
        "steps",
        "trainingDuration",
        "trainingIntensity",
        "goal",
      ]),
    );
  });

  it("extracts a complete explicit intake without inventing an activity level", () => {
    const prefill = extractTdeePrefill(
      "Tính TDEE cho nam 30 tuổi, cao 175cm, nặng 75kg, làm văn phòng ngồi nhiều, khoảng 4000 bước/ngày, tập 5 buổi/tuần, 50 phút/buổi cường độ vừa, mục tiêu giảm mỡ",
    );

    expect(prefill).toEqual({
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
    });
    expect(getMissingTdeeInputFields(prefill)).toEqual([]);
  });

  it("builds a persisted form card and names only the missing evidence", () => {
    const response = buildTdeeIntakeResponse(
      "Tôi là nữ, 26 tuổi, tính TDEE giúp tôi",
    );

    expect(response.uiCard).toMatchObject({
      cardType: "tdeeForm",
      data: {
        prefill: { gender: "female", age: 26 },
      },
    });
    expect(response.uiCard.data.missingFields).toContain("heightCm");
    expect(response.text).toMatch(/bổ sung/i);
    expect(response.text).not.toMatch(/đã tính|kcal/i);
  });
});
