import { describe, expect, it } from "vitest";
import { bodyMetricsSchema, trainingGoalSchema } from "../schema";

describe("F1 intake optional numeric fields", () => {
  it("accepts empty optional biometrics without coercing them to zero", () => {
    const result = bodyMetricsSchema.safeParse({
      heightCm: "160",
      weightKg: "55",
      bodyFatPercent: "",
      waistCm: "",
      hipCm: "",
      restingHeartRate: "",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      heightCm: 160,
      weightKg: 55,
      bodyFatPercent: undefined,
      waistCm: undefined,
      hipCm: undefined,
      restingHeartRate: undefined,
    });
  });

  it("requires height and weight because the server needs them for BMI", () => {
    const result = bodyMetricsSchema.safeParse({
      heightCm: "",
      weightKg: "",
      bodyFatPercent: "",
      waistCm: "",
      hipCm: "",
      restingHeartRate: "",
    });

    expect(result.success).toBe(false);
    expect(
      Object.fromEntries(
        result.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    ).toEqual({
      heightCm: "Vui lòng nhập chiều cao",
      weightKg: "Vui lòng nhập cân nặng",
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
      targetTimeframe: "",
    });

    expect(result.success).toBe(true);
    expect(result.data.targetWeightKg).toBeUndefined();
  });

  it("accepts a free-text target timeframe up to 60 characters", () => {
    const base = {
      currentlyTraining: false,
      trainingExperience: "none",
      primaryGoal: "fat_loss",
    };

    const valid = trainingGoalSchema.safeParse({
      ...base,
      targetTimeframe: " 6 tháng ",
    });
    const tooLong = trainingGoalSchema.safeParse({
      ...base,
      targetTimeframe: "a".repeat(61),
    });

    expect(valid.success).toBe(true);
    expect(valid.data.targetTimeframe).toBe("6 tháng");
    expect(tooLong.success).toBe(false);
  });
});
