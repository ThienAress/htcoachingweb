import { describe, expect, it } from "vitest";
import { bodyMetricsSchema, trainingGoalSchema } from "../schema";

describe("F1 intake optional numeric fields", () => {
  it("accepts empty optional biometrics without coercing them to zero", () => {
    const result = bodyMetricsSchema.safeParse({
      heightCm: "",
      weightKg: "",
      bodyFatPercent: "",
      waistCm: "",
      hipCm: "",
      restingHeartRate: "",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      heightCm: undefined,
      weightKg: undefined,
      bodyFatPercent: undefined,
      waistCm: undefined,
      hipCm: undefined,
      restingHeartRate: undefined,
    });
  });

  it("accepts an empty optional target weight and still validates goals", () => {
    const result = trainingGoalSchema.safeParse({
      currentlyTraining: false,
      trainingDaysPerWeek: "",
      sessionDurationMinutes: "",
      sportsHistory: "",
      trainingExperience: "none",
      breakDuration: "",
      primaryGoal: "fat_loss",
      targetWeightKg: "",
      targetDeadline: "",
    });

    expect(result.success).toBe(true);
    expect(result.data.targetWeightKg).toBeUndefined();
  });
});
