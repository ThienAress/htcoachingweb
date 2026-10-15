import { describe, expect, it } from "vitest";
import {
  buildFormDefaults,
  computeBmi,
  describePrevious,
  formatDeltaWithUnit,
  retestMode,
  formatDelta,
  formatNumber,
  retestLevel,
  toPayload,
} from "../f1PhaseReview";

const context = {
  plannedSessions: 30,
  recommendations: ["Ngủ đủ 7 giờ mỗi đêm"],
  retests: [
    { metricKey: "lowerBody", name: "Goblet Squat", tier: "standard", inputMode: "reps", selectedProtocol: null, previousLevel: "average" },
    { metricKey: "cardioCapacity", name: "Treadmill Walk", tier: "easy", inputMode: "", selectedProtocol: null, previousLevel: "low" },
  ],
};

describe("retestLevel", () => {
  it("scores reps against the default 2-3 × 8-10 protocol", () => {
    // 3 hiệp × 10 lần là mức tối đa của chuẩn mặc định → điểm 10 → Tốt.
    expect(retestLevel({ inputMode: "reps", sets: "3", reps: "10" })).toBe("good");
    // 2 hiệp × 8 lần là mức tối thiểu: 10 × (0,4 × 0,7 + 0,6 × 0,7) = 7 điểm → Trung bình.
    expect(retestLevel({ inputMode: "reps", sets: "2", reps: "8" })).toBe("average");
    expect(retestLevel({ inputMode: "reps", sets: "", reps: "" })).toBe("");
  });

  it("uses the coach's level when the exercise cannot be scored automatically", () => {
    expect(retestLevel({ inputMode: "", manualLevel: "average" })).toBe("average");
  });
});

describe("buildFormDefaults and toPayload", () => {
  it("prefills planned sessions and sends only retests that have a result", () => {
    const values = buildFormDefaults(context);
    expect(values.adherence.plannedSessions).toBe("30");
    expect(values.recommendationChecks).toEqual([{ text: "Ngủ đủ 7 giờ mỗi đêm", status: "" }]);

    values.actual.weightKg = "71,8";
    values.adherence.completedSessions = "28";
    values.recommendationChecks[0].status = "partial";
    values.retests[0].sets = "3";
    values.retests[0].reps = "10";

    const payload = toPayload(values);
    expect(payload.actual).toEqual({
      weightKg: 71.8,
      waistCm: null,
      hipCm: null,
      bodyFatPercent: null,
      restingHeartRate: null,
    });
    expect(payload.adherence).toMatchObject({ plannedSessions: 30, completedSessions: 28 });
    expect(payload.retests).toEqual([
      { metricKey: "lowerBody", name: "Goblet Squat", tier: "standard", sets: 3, reps: 10, durationSec: null, result: null, level: "good" },
    ]);
  });

  it("restores a saved review for editing", () => {
    const values = buildFormDefaults(context, {
      measuredAt: "2027-01-05T05:00:00.000Z",
      actual: { weightKg: 72 },
      adherence: { plannedSessions: 33, completedSessions: 30, nutrition: "good", sleep: "poor" },
      recommendationChecks: [{ text: "Ngủ đủ 7 giờ mỗi đêm", status: "met" }],
      retests: [{ metricKey: "cardioCapacity", name: "Treadmill Walk", level: "average" }],
      ohsa: { items: [{ view: "lateral", key: "low_back_arch", label: "Võng thắt lưng", status: "resolved" }, { view: "anterior", key: "", label: "Gối chụm vào trong", status: "new" }] },
    });

    expect(values.measuredAt).toBe("2027-01-05");
    expect(values.adherence).toEqual({ plannedSessions: "33", completedSessions: "30", nutrition: "good", sleep: "poor" });
    expect(values.recommendationChecks[0].status).toBe("met");
    expect(values.retests[1].manualLevel).toBe("average");
    expect(values.ohsa.items).toEqual([
      { view: "anterior", key: "", label: "Gối chụm vào trong", status: "new", fixed: false },
    ]);
  });
});

describe("retest modes", () => {
  it("keeps the input mode the trainer used at stage 1", () => {
    expect(retestMode({ resultKind: "minutes" })).toBe("result");
    expect(retestMode({ inputMode: "time" })).toBe("time");
    expect(retestMode({ inputMode: "reps" })).toBe("reps");
    expect(retestMode({})).toBe("reps");
  });

  it("scores cardio results with the same targets as the assessment", () => {
    // 24 phút: 10 × (0,7 + 0,3 × 0,4) = 8,2 → Tốt; 8 phút: 10 × 0,7 × 0,4 = 2,8 → Yếu.
    expect(retestLevel({ resultKind: "minutes", result: "24" })).toBe("good");
    expect(retestLevel({ resultKind: "minutes", result: "8" })).toBe("low");
    expect(retestLevel({ resultKind: "hr_drop", result: "" })).toBe("");
  });

  it("describes the previous result in the original unit", () => {
    expect(describePrevious({ previousLevel: "good", previous: { sets: 3, reps: 12 } })).toBe("3 hiệp × 12 reps · Tốt");
    expect(describePrevious({ previousLevel: "average", previous: { sets: 2, durationSec: 30 } })).toBe("2 hiệp × 30 giây · Trung bình");
    expect(describePrevious({ resultKind: "minutes", previousLevel: "good", previous: { result: 24 } })).toBe("24 phút · Tốt");
  });
});

describe("number formatting", () => {
  it("computes BMI and formats deltas with units", () => {
    expect(computeBmi("71,8", 160)).toBe(28);
    expect(computeBmi("", 160)).toBeNull();
    expect(formatDeltaWithUnit(-20, "waistCm")).toBe("−20 cm");
    expect(formatDeltaWithUnit(-5, "weightKg")).toBe("−5 kg");
    expect(formatDeltaWithUnit(0, "bodyFatPercent")).toBe("0 %");
  });
});

describe("number formatting", () => {
  it("uses Vietnamese decimals and a real minus sign", () => {
    expect(formatNumber(71.84)).toBe("71,8");
    expect(formatNumber(null)).toBe("--");
    expect(formatDelta(-3.2)).toBe("−3,2");
    expect(formatDelta(0)).toBe("0");
    expect(formatDelta(1.5)).toBe("+1,5");
  });
});
