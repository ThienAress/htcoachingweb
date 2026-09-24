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

  it("maps the natural Vietnamese duration order used in chat", () => {
    const prefill = extractTdeePrefill(
      "Nam 28 tuổi, cao 175 cm, nặng 78 kg, tập 3-4 buổi/tuần, mỗi buổi khoảng 60 phút, cường độ vừa",
    );

    expect(prefill.trainingDuration).toBe("between_45_60");
  });

  it("does not treat an unrelated cooking duration as training evidence", () => {
    const prefill = extractTdeePrefill("Tôi tập 3 buổi/tuần, món ăn cần nấu khoảng 60 phút");
    expect(prefill).toMatchObject({ trainingFrequency: "three_four" });
    expect(prefill).not.toHaveProperty("trainingDuration");
  });

  it.each([
    ["Tôi tập 50 phút/buổi", "between_45_60"],
    ["Trung bình mỗi buổi khoảng 60 phút", "between_45_60"],
    ["Mỗi buổi tập 45 phút", "between_30_45"],
  ])("recognizes explicit training duration phrasing: %s", (message, expected) => {
    expect(extractTdeePrefill(message).trainingDuration).toBe(expected);
  });
});
