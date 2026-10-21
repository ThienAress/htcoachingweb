import { describe, expect, it } from "vitest";

import { buildRecommendation } from "../recommendation.js";
import { buildSelfScreening } from "../screening.js";
import { scoreTests } from "../scoring.js";

const build = ({ profile, training, screening = {}, tests = {} }) => {
  const flags = buildSelfScreening({ screening, training });
  const scoring = scoreTests({ tests, profile });
  return buildRecommendation({ profile, training, screening, flags, scoring });
};

const baseProfile = {
  gender: "male",
  age: 30,
  heightCm: 170,
  weightKg: 80,
  restingHeartRate: 60,
  sleepHours: 8,
  stressLevel: "low",
};

describe("buildRecommendation", () => {
  it("người mới tập bắt đầu ở giai đoạn 1, tập 2-3 buổi toàn thân", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "beginner", primaryGoal: "fat_loss", trainingDaysPerWeek: 3 },
    });
    expect(result.mode).toBe("plan");
    expect(result.startPhase.code).toBe("phase_1");
    expect(result.weeklyPlan.recommendedRange).toEqual({ min: 2, max: 3 });
    expect(result.weeklyPlan.split).toContain("Full Body");
    expect(result.resistance.repRange).toEqual({ min: 12, max: 20 });
  });

  it("người tập lâu năm mức khá trở lên vào giai đoạn 3, chia 4 buổi", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "advanced", primaryGoal: "muscle_gain", trainingDaysPerWeek: 4 },
      tests: {
        upperBodyPush: { variant: "standard", reps: 36 },
        coreEndurance: { variant: "full", seconds: 100 },
        cardio: { variant: "standard", minutes: 13, endHeartRate: 125 },
      },
    });
    expect(result.startPhase.code).toBe("phase_3");
    expect(result.weeklyPlan.daysPerWeek).toBe(4);
    expect(result.weeklyPlan.split).toContain("Upper/Lower");
    expect(result.resistance.weeklySetsPerMuscle).toEqual({ min: 10, max: 20 });
  });

  it("có kinh nghiệm nhưng chưa có dữ liệu xếp mức thì vào giai đoạn 2", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "intermediate", primaryGoal: "maintenance" },
    });
    expect(result.startPhase.code).toBe("phase_2");
  });

  it("tính vùng nhịp tim bằng Tanaka và dự trữ nhịp tim (30 tuổi, nghỉ 60)", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "intermediate", primaryGoal: "maintenance" },
    });
    expect(result.cardio.heartRateZones).toEqual({
      hrMax: 187,
      moderate: { min: 111, max: 135 },
      vigorous: { min: 136, max: 173 },
    });
  });

  it("protein theo mục tiêu tăng cơ cho người 80 kg là 128-176 g mỗi ngày", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "intermediate", primaryGoal: "muscle_gain" },
    });
    expect(result.nutrition.proteinGramsPerDay).toEqual({ min: 128, max: 176 });
    expect(result.nutrition.tools.tdee).toBe("/tdee-calculator");
  });

  it("BMI thấp kèm mục tiêu giảm cân thì cảnh báo không nên giảm", () => {
    const result = build({
      profile: { ...baseProfile, weightKg: 50 },
      training: { currentlyTraining: true, trainingExperience: "intermediate", primaryGoal: "fat_loss" },
    });
    expect(result.nutrition.cautions.join(" ")).toContain("không khuyến khích giảm cân");
  });

  it("ngủ dưới 6 giờ hoặc căng thẳng cao thì giảm 2 set mỗi tuần mỗi nhóm cơ", () => {
    const result = build({
      profile: { ...baseProfile, sleepHours: 5 },
      training: { currentlyTraining: true, trainingExperience: "advanced", primaryGoal: "muscle_gain" },
      tests: { upperBodyPush: { variant: "standard", reps: 36 }, coreEndurance: { variant: "full", seconds: 100 } },
    });
    expect(result.resistance.weeklySetsPerMuscle).toEqual({ min: 10, max: 18 });
    expect(result.recovery.notes.join(" ")).toContain("dưới 7 giờ");
  });

  it("hold_test không đưa kế hoạch tập, chỉ khuyến nghị gặp chuyên gia", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "advanced", primaryGoal: "muscle_gain" },
      screening: { warningSigns: ["chest_pain"] },
    });
    expect(result.mode).toBe("hold");
    expect(result.resistance).toBeUndefined();
    expect(result.cautions.join(" ")).toContain("bác sĩ");
  });

  it("nhóm yếu nhận bài giảm tải; chỗ đau có lưu ý riêng; tên bài tiếng Anh", () => {
    const result = build({
      profile: baseProfile,
      training: { currentlyTraining: true, trainingExperience: "intermediate", primaryGoal: "maintenance" },
      screening: { painLevel: 2, painLocation: ["knee"] },
      tests: { upperBodyPush: { variant: "standard", reps: 10 } },
    });
    const upper = result.focusAreas.find((area) => area.metric === "upperBodyPush");
    expect(upper.exercises).toEqual(["Wall Push-Up", "Incline Push-Up", "Knee Push-Up"]);
    expect(result.cautions.join(" ")).toContain("Đầu gối");
    expect(result.libraryPath).toBe("/exercises");
  });
});
