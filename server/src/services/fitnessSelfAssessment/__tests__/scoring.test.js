import { describe, expect, it } from "vitest";

import { scoreTests } from "../scoring.js";
import {
  classifyBmiAsia,
  estimateVo2MaxRockport,
  rateChairStand,
  ratePlank,
  ratePushUp,
  rateVo2Max,
} from "../norms.js";

describe("bảng chuẩn hít đất (CSEP/Payne 2000)", () => {
  it("nam 25 tuổi hít đất chuẩn: biên 16/17/35/36", () => {
    const rate = (reps) => ratePushUp({ gender: "male", variant: "standard", reps, age: 25 });
    expect(rate(16)).toBe("needs_improvement");
    expect(rate(17)).toBe("fair");
    expect(rate(28)).toBe("good");
    expect(rate(35)).toBe("very_good");
    expect(rate(36)).toBe("excellent");
  });

  it("nữ 25 tuổi hít đất quỳ: 9, 21 và 30 lần", () => {
    const rate = (reps) => ratePushUp({ gender: "female", variant: "knee", reps, age: 25 });
    expect(rate(9)).toBe("needs_improvement");
    expect(rate(21)).toBe("very_good");
    expect(rate(30)).toBe("excellent");
  });

  it("không xếp mức khi chưa có bảng chuẩn phù hợp", () => {
    expect(ratePushUp({ gender: "male", variant: "knee", reps: 30, age: 25 })).toBeNull();
    expect(ratePushUp({ gender: "female", variant: "standard", reps: 30, age: 25 })).toBeNull();
    expect(ratePushUp({ gender: "male", variant: "standard", reps: 30, age: 70 })).toBeNull();
  });

  it("tuổi 18-19 dùng nhóm 20-29, nhóm 40-49 có cận riêng", () => {
    expect(ratePushUp({ gender: "male", variant: "standard", reps: 22, age: 18 })).toBe("good");
    expect(ratePushUp({ gender: "male", variant: "standard", reps: 25, age: 45 })).toBe("excellent");
  });
});

describe("Rockport và bảng VO2max (Cooper Institute)", () => {
  it("nam 30 tuổi, 80 kg, 14 phút, nhịp tim cuối 130 cho VO2max 47,9", () => {
    const vo2max = estimateVo2MaxRockport({
      gender: "male",
      age: 30,
      weightKg: 80,
      minutes: 14,
      endHeartRate: 130,
    });
    expect(vo2max).toBe(47.9);
    expect(rateVo2Max({ gender: "male", vo2max, age: 30 })).toBe("good");
  });

  it("biên percentile của nữ 25 tuổi: 36,0 / 36,1 / 49,6", () => {
    expect(rateVo2Max({ gender: "female", vo2max: 36.0, age: 25 })).toBe("needs_improvement");
    expect(rateVo2Max({ gender: "female", vo2max: 36.1, age: 25 })).toBe("fair");
    expect(rateVo2Max({ gender: "female", vo2max: 49.6, age: 25 })).toBe("excellent");
  });

  it("thiếu dữ liệu thì không ước lượng", () => {
    expect(estimateVo2MaxRockport({ gender: "male", age: 30, weightKg: 80, minutes: 14 })).toBeNull();
  });
});

describe("đứng lên khỏi ghế, plank và BMI châu Á", () => {
  it("CDC STEADI: nam 62 tuổi dưới 14 lần là cần cải thiện, dưới 60 tuổi không xếp mức", () => {
    expect(rateChairStand({ gender: "male", reps: 13, age: 62 })).toBe("needs_improvement");
    expect(rateChairStand({ gender: "male", reps: 14, age: 62 })).toBe("good");
    expect(rateChairStand({ gender: "female", reps: 9, age: 72 })).toBe("needs_improvement");
    expect(rateChairStand({ gender: "male", reps: 30, age: 40 })).toBeNull();
  });

  it("plank: 29, 45, 120 giây", () => {
    expect(ratePlank({ seconds: 29 })).toBe("needs_improvement");
    expect(ratePlank({ seconds: 45 })).toBe("fair");
    expect(ratePlank({ seconds: 120 })).toBe("excellent");
  });

  it("BMI châu Á: 22,9 bình thường, 23 thừa cân, 27,7 béo phì độ 1", () => {
    expect(classifyBmiAsia(22.9)).toBe("normal");
    expect(classifyBmiAsia(23)).toBe("overweight");
    expect(classifyBmiAsia(27.7)).toBe("obese_1");
  });
});

describe("scoreTests", () => {
  const profile = { gender: "male", age: 30, weightKg: 80 };

  it("trung bình hạng của các nhóm đã xếp mức và bỏ qua nhóm chỉ làm mốc", () => {
    const result = scoreTests({
      profile,
      tests: {
        upperBodyPush: { variant: "standard", reps: 36 },
        lowerBody: { variant: "standard", reps: 25 },
        coreEndurance: { variant: "full", seconds: 45 },
        cardio: { variant: "standard", minutes: 14, endHeartRate: 130 },
      },
    });

    // excellent(5) + fair(2) + good(3) trung bình 3,33 làm tròn thành mức khá; lowerBody dưới 60 tuổi không xếp mức.
    expect(result.metrics.lowerBody.level).toBeNull();
    expect(result.metrics.lowerBody.note).toContain("60 tuổi");
    expect(result.ratedCount).toBe(3);
    expect(result.overallRank).toBe(3.33);
    expect(result.overallLevel).toBe("good");
  });

  it("không có nhóm nào xếp mức thì không có mức tổng", () => {
    const result = scoreTests({
      profile,
      tests: { upperBodyPush: { variant: "wall", reps: 20 } },
    });
    expect(result.overallLevel).toBeNull();
    expect(result.metrics.upperBodyPush.note).toContain("mốc");
  });
});
