import { describe, expect, it } from "vitest";

import {
  buildTdeeSubmitRequest,
  createTdeeFormState,
  getTdeeFormErrors,
} from "../cards/tdeeForm.config.js";

const completeForm = {
  gender: "male",
  age: "28",
  heightCm: "175",
  weightKg: "75",
  activityLevel: "moderate",
  dailyMovement: "mixed",
  steps: "between_5000_7999",
  trainingFrequency: "three_four",
  trainingDuration: "between_45_60",
  trainingIntensity: "moderate",
  goal: "maintenance",
};

describe("TDEE chat form runtime", () => {
  it("hydrates only allowlisted prefill fields from the persisted card", () => {
    expect(
      createTdeeFormState({
        gender: "male",
        age: 28,
        trainingFrequency: "three_four",
        activityLevel: "very_active",
        admin: true,
      }),
    ).toMatchObject({
      gender: "male",
      age: "28",
      trainingFrequency: "three_four",
      activityLevel: "",
    });
  });

  it("blocks missing and out-of-range required values", () => {
    expect(getTdeeFormErrors({ ...completeForm, heightCm: "" })).toMatchObject({
      heightCm: expect.stringMatching(/không được bỏ trống/i),
    });
    expect(getTdeeFormErrors({ ...completeForm, age: "12" })).toMatchObject({
      age: expect.stringMatching(/13.*100/),
    });
  });

  it("submits numeric structured data instead of relying on prose parsing", () => {
    const request = buildTdeeSubmitRequest(completeForm);

    expect(request.structuredAction).toEqual({
      type: "calculate_tdee",
      payload: {
        gender: "male",
        age: 28,
        heightCm: 175,
        weightKg: 75,
        dailyMovement: "mixed",
        steps: "between_5000_7999",
        trainingFrequency: "three_four",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "maintenance",
      },
    });
    expect(request.text).toMatch(/TDEE/i);
  });
});
