import { describe, it, expect } from "vitest";
import {
  levelToRank,
  rankToLevel,
  averageRanks,
  computePostureLevel,
  computeStrengthLevel,
  computeEnduranceLevel,
  restingHrToLevel,
  computeCardioLevel,
  computeOverallPhysicalLevel,
} from "../assessment.helpers";

// =============================================================================
// TDD: assessment.helpers.js — Test logic đánh giá thể chất khách hàng
// Đây là business logic quan trọng, ảnh hưởng trực tiếp đến báo cáo F1
// =============================================================================

describe("levelToRank", () => {
  it("trả về rank 1 cho level low", () => {
    expect(levelToRank("low")).toBe(1);
  });

  it("trả về rank 2 cho level below_average", () => {
    expect(levelToRank("below_average")).toBe(2);
  });

  it("trả về rank 3 cho level average", () => {
    expect(levelToRank("average")).toBe(3);
  });

  it("trả về rank 4 cho level good", () => {
    expect(levelToRank("good")).toBe(4);
  });

  it("trả về 2 (default) khi level không hợp lệ", () => {
    expect(levelToRank("invalid")).toBe(2);
  });

  it("trả về 2 (default) khi không truyền tham số", () => {
    expect(levelToRank()).toBe(2);
  });

  it("trả về 2 (default) khi truyền empty string", () => {
    expect(levelToRank("")).toBe(2);
  });
});

describe("rankToLevel", () => {
  it('trả về "low" cho rank <= 1.5', () => {
    expect(rankToLevel(1)).toBe("low");
    expect(rankToLevel(1.5)).toBe("low");
  });

  it('trả về "below_average" cho rank 1.6 - 2.5', () => {
    expect(rankToLevel(2)).toBe("below_average");
    expect(rankToLevel(2.5)).toBe("below_average");
  });

  it('trả về "average" cho rank 2.6 - 3.25', () => {
    expect(rankToLevel(3)).toBe("average");
    expect(rankToLevel(3.25)).toBe("average");
  });

  it('trả về "good" cho rank > 3.25', () => {
    expect(rankToLevel(3.5)).toBe("good");
    expect(rankToLevel(4)).toBe("good");
  });

  it('trả về "below_average" khi không truyền tham số (default = 2)', () => {
    expect(rankToLevel()).toBe("below_average");
  });
});

describe("averageRanks", () => {
  it("tính trung bình đúng cho danh sách levels", () => {
    // ["low", "good"] → [1, 4] → avg = 2.5
    expect(averageRanks(["low", "good"])).toBe(2.5);
  });

  it("trả về 2 khi danh sách rỗng", () => {
    expect(averageRanks([])).toBe(2);
  });

  it("trả về 2 khi không truyền tham số", () => {
    expect(averageRanks()).toBe(2);
  });

  it("bỏ qua invalid levels (dùng default rank 2)", () => {
    // ["low", "invalid"] → [1, 2] → avg = 1.5
    expect(averageRanks(["low", "invalid"])).toBe(1.5);
  });

  it("xử lý danh sách chỉ có 1 phần tử", () => {
    expect(averageRanks(["good"])).toBe(4);
  });
});

describe("restingHrToLevel", () => {
  it('trả về "good" cho nhịp tim nghỉ <= 65', () => {
    expect(restingHrToLevel(60)).toBe("good");
    expect(restingHrToLevel(65)).toBe("good");
  });

  it('trả về "average" cho nhịp tim 66-75', () => {
    expect(restingHrToLevel(70)).toBe("average");
    expect(restingHrToLevel(75)).toBe("average");
  });

  it('trả về "below_average" cho nhịp tim 76-85', () => {
    expect(restingHrToLevel(80)).toBe("below_average");
    expect(restingHrToLevel(85)).toBe("below_average");
  });

  it('trả về "low" cho nhịp tim > 85', () => {
    expect(restingHrToLevel(90)).toBe("low");
  });

  it('trả về "below_average" khi input là 0 hoặc falsy', () => {
    expect(restingHrToLevel(0)).toBe("below_average");
    expect(restingHrToLevel(null)).toBe("below_average");
    expect(restingHrToLevel(undefined)).toBe("below_average");
  });

  it("xử lý input dạng string số", () => {
    expect(restingHrToLevel("60")).toBe("good");
    expect(restingHrToLevel("90")).toBe("low");
  });
});

describe("computePostureLevel", () => {
  it('trả về "good" khi không có vấn đề tư thế', () => {
    const assessment = {
      postureAssessment: {
        feetAnkles: "normal",
        knees: "normal",
        lphc: "normal",
        shouldersThoracic: "normal",
        headNeck: "normal",
      },
      movementAssessment: {
        overheadSquat: { anterior: [], lateral: [], posterior: [] },
      },
    };
    expect(computePostureLevel(assessment)).toBe("good");
  });

  it('trả về "low" khi có >= 7 vấn đề tổng cộng', () => {
    const assessment = {
      postureAssessment: {
        feetAnkles: "pronated",
        knees: "valgus",
        lphc: "anterior_tilt",
        shouldersThoracic: "rounded",
        headNeck: "forward",
      },
      movementAssessment: {
        overheadSquat: {
          anterior: ["knees_cave", "feet_turn_out"],
          lateral: [],
          posterior: [],
        },
      },
    };
    // 5 posture issues + 2 OHSA issues = 7 → "low"
    expect(computePostureLevel(assessment)).toBe("low");
  });

  it('trả về "average" khi có 2-3 vấn đề', () => {
    const assessment = {
      postureAssessment: {
        feetAnkles: "pronated",
        knees: "valgus",
        lphc: "normal",
        shouldersThoracic: "normal",
        headNeck: "normal",
      },
      movementAssessment: {
        overheadSquat: { anterior: [], lateral: [], posterior: [] },
      },
    };
    // 2 posture issues + 0 OHSA = 2 → "average"
    expect(computePostureLevel(assessment)).toBe("average");
  });

  it("xử lý assessment rỗng / undefined", () => {
    expect(computePostureLevel({})).toBe("good");
    expect(computePostureLevel()).toBe("good");
  });
});

describe("computeStrengthLevel", () => {
  it("tính trung bình 4 nhóm cơ và trả về level", () => {
    const assessment = {
      strengthAssessment: {
        upperBodyPush: { level: "good" },
        upperBodyPull: { level: "good" },
        lowerBody: { level: "average" },
        coreStrength: { level: "average" },
      },
    };
    // [4, 4, 3, 3] → avg = 3.5 → "good"
    expect(computeStrengthLevel(assessment)).toBe("good");
  });

  it("xử lý khi thiếu một số nhóm cơ", () => {
    const assessment = {
      strengthAssessment: {
        upperBodyPush: { level: "low" },
      },
    };
    // [1, 2, 2, 2] (undefined → default 2) → avg = 1.75
    const result = computeStrengthLevel(assessment);
    expect(["low", "below_average"]).toContain(result);
  });

  it("xử lý assessment rỗng", () => {
    const result = computeStrengthLevel({});
    expect(result).toBe("below_average"); // all default → 2 → "below_average"
  });
});

describe("computeEnduranceLevel", () => {
  it("tính trung bình muscular + core endurance", () => {
    const assessment = {
      enduranceAssessment: {
        muscularEndurance: { level: "good" },
        coreEndurance: { level: "average" },
      },
    };
    // [4, 3] → avg = 3.5 → "good"
    expect(computeEnduranceLevel(assessment)).toBe("good");
  });

  it("xử lý assessment rỗng", () => {
    expect(computeEnduranceLevel({})).toBe("below_average");
  });
});

describe("computeCardioLevel", () => {
  it("tính trung bình 3 chỉ số tim mạch", () => {
    const assessment = {
      cardioAssessment: {
        cardioCapacity: { level: "good" },
        recoveryHeartRate: { level: "average" },
        restingHeartRate: 60, // → "good"
      },
    };
    // [4, 3, 4] → avg = 3.67 → "good"
    expect(computeCardioLevel(assessment)).toBe("good");
  });

  it("xử lý khi restingHeartRate cao", () => {
    const assessment = {
      cardioAssessment: {
        cardioCapacity: { level: "average" },
        recoveryHeartRate: { level: "average" },
        restingHeartRate: 90, // → "low" → rank 1
      },
    };
    // [3, 3, 1] → avg = 2.33 → "below_average"
    expect(computeCardioLevel(assessment)).toBe("below_average");
  });
});

describe("computeOverallPhysicalLevel", () => {
  it('trả về "good" khi tất cả domains đều tốt', () => {
    const assessment = {
      postureAssessment: {
        feetAnkles: "normal",
        knees: "normal",
        lphc: "normal",
        shouldersThoracic: "normal",
        headNeck: "normal",
      },
      movementAssessment: {
        overheadSquat: { anterior: [], lateral: [], posterior: [] },
      },
      strengthAssessment: {
        upperBodyPush: { level: "good" },
        upperBodyPull: { level: "good" },
        lowerBody: { level: "good" },
        coreStrength: { level: "good" },
      },
      enduranceAssessment: {
        muscularEndurance: { level: "good" },
        coreEndurance: { level: "good" },
      },
      cardioAssessment: {
        cardioCapacity: { level: "good" },
        recoveryHeartRate: { level: "good" },
        restingHeartRate: 55,
      },
    };
    expect(computeOverallPhysicalLevel(assessment)).toBe("good");
  });

  it('trả về "low" khi >= 2 domains ở mức low', () => {
    const assessment = {
      postureAssessment: {
        feetAnkles: "pronated",
        knees: "valgus",
        lphc: "anterior_tilt",
        shouldersThoracic: "rounded",
        headNeck: "forward",
      },
      movementAssessment: {
        overheadSquat: {
          anterior: ["knees_cave", "feet_turn_out"],
          lateral: [],
          posterior: [],
        },
      },
      strengthAssessment: {
        upperBodyPush: { level: "low" },
        upperBodyPull: { level: "low" },
        lowerBody: { level: "low" },
        coreStrength: { level: "low" },
      },
      enduranceAssessment: {
        muscularEndurance: { level: "good" },
        coreEndurance: { level: "good" },
      },
      cardioAssessment: {
        cardioCapacity: { level: "good" },
        recoveryHeartRate: { level: "good" },
        restingHeartRate: 55,
      },
    };
    expect(computeOverallPhysicalLevel(assessment)).toBe("low");
  });

  it("xử lý assessment rỗng", () => {
    const result = computeOverallPhysicalLevel({});
    expect(typeof result).toBe("string");
    expect(["low", "below_average", "average", "good"]).toContain(result);
  });
});
