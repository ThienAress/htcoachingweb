import { describe, expect, it } from "vitest";

import { buildSystemFlags } from "../../../controllers/f1Customer/intake.helpers.js";
import { buildSelfScreening } from "../screening.js";

const experienced = { currentlyTraining: true, trainingExperience: "intermediate", breakDuration: "" };

describe("buildSelfScreening", () => {
  it.each([
    [0, "none"],
    [1, "mild"],
    [4, "mild"],
    [5, "moderate"],
    [6, "moderate"],
    [7, "severe"],
    [10, "severe"],
  ])("mức đau %i cho cờ %s", (painLevel, painFlag) => {
    const result = buildSelfScreening({ screening: { painLevel }, training: experienced });
    expect(result.painFlag).toBe(painFlag);
  });

  it("người tập đều, không cờ nào thì làm đủ bài", () => {
    const result = buildSelfScreening({ screening: {}, training: experienced });
    expect(result.testPermission).toBe("full_test");
    expect(result.recommendedStartPhase).toBe("phase_1");
  });

  it("dấu hiệu cảnh báo hoặc hạn chế của bác sĩ thì khóa bài test", () => {
    const warning = buildSelfScreening({ screening: { warningSigns: ["chest_pain"] }, training: experienced });
    const doctor = buildSelfScreening({
      screening: { doctorRestrictions: "Không tập nặng" },
      training: experienced,
    });
    expect(warning.testPermission).toBe("hold_test");
    expect(warning.recommendedStartPhase).toBe("pending_review");
    expect(doctor.testPermission).toBe("hold_test");
  });

  it("đau từ mức 5, bệnh nền, phẫu thuật hoặc mới tập thì chỉ làm bài giảm tải", () => {
    expect(buildSelfScreening({ screening: { painLevel: 5 }, training: experienced }).testPermission).toBe("modified_test");
    expect(
      buildSelfScreening({ screening: { currentConditions: "Huyết áp cao" }, training: experienced }).testPermission,
    ).toBe("modified_test");
    expect(
      buildSelfScreening({
        screening: {},
        training: { currentlyTraining: true, trainingExperience: "beginner" },
      }).testPermission,
    ).toBe("modified_test");
  });

  it("bỏ qua dấu hiệu cảnh báo không hợp lệ", () => {
    const result = buildSelfScreening({ screening: { warningSigns: ["khong_hop_le"] }, training: experienced });
    expect(result.testPermission).toBe("full_test");
  });
});

describe("đối chiếu với luật sàng lọc F1 (chống lệch ngưỡng)", () => {
  const fixtures = [
    { screening: {}, training: experienced },
    { screening: { painLevel: 3 }, training: experienced },
    { screening: { painLevel: 5 }, training: experienced },
    { screening: { painLevel: 8 }, training: experienced },
    { screening: { warningSigns: ["dizziness"] }, training: experienced },
    { screening: { doctorRestrictions: "Tránh chạy" }, training: experienced },
    { screening: { currentConditions: "Hen suyễn" }, training: experienced },
    { screening: { surgeries: "Mổ gối" }, training: experienced },
    { screening: {}, training: { currentlyTraining: false, trainingExperience: "advanced" } },
    { screening: {}, training: { currentlyTraining: true, trainingExperience: "none" } },
    { screening: {}, training: { currentlyTraining: true, trainingExperience: "advanced", breakDuration: "3 tháng" } },
  ];

  it.each(fixtures.map((fixture, index) => [index, fixture]))("fixture %i trùng cờ với buildSystemFlags", (_i, fixture) => {
    const mine = buildSelfScreening(fixture);
    const f1 = buildSystemFlags({
      healthScreening: fixture.screening,
      trainingProfileGoal: fixture.training,
    });
    expect({
      painFlag: mine.painFlag,
      medicalReviewFlag: mine.medicalReviewFlag,
      testPermission: mine.testPermission,
      recommendedStartPhase: mine.recommendedStartPhase,
    }).toEqual({
      painFlag: f1.painFlag,
      medicalReviewFlag: f1.medicalReviewFlag,
      testPermission: f1.testPermission,
      recommendedStartPhase: f1.recommendedStartPhase,
    });
  });
});
