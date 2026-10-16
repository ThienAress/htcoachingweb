import { describe, expect, it } from "vitest";
import {
  applySuggestion,
  buildDesignDefaults,
  toCustomStage,
  toPreviewStage,
} from "../f1StageDesign";

describe("buildDesignDefaults", () => {
  it("starts empty with a 3-day schedule when there is no saved plan", () => {
    const values = buildDesignDefaults();
    expect(values.phaseKey).toBe("phase_1");
    expect(values.weeklySchedule.days.filter(Boolean)).toHaveLength(3);
    expect(values.keyFocus).toEqual([]);
    expect(values.overrides.weightKg).toBe("");
  });

  it("restores a saved trainer plan with its overrides and translates system focus keys", () => {
    const values = buildDesignDefaults({
      plan: {
        phaseKey: "phase_2",
        durationWeeks: 10,
        objective: "Tăng sức mạnh bền",
        keyFocus: ["energy_expenditure", "Giữ form"],
        weeklySchedule: { days: [true, true, false, false, true, false, false], sessionMinutes: 45, split: "upper_lower", note: "" },
      },
      overrides: { weightKg: 66 },
    });

    expect(values).toMatchObject({ phaseKey: "phase_2", durationWeeks: "10", objective: "Tăng sức mạnh bền" });
    expect(values.keyFocus).toEqual([{ value: "Tăng tiêu hao năng lượng" }, { value: "Giữ form" }]);
    expect(values.weeklySchedule).toMatchObject({ sessionMinutes: "45", split: "upper_lower" });
    expect(values.overrides.weightKg).toBe("66");
  });
});

describe("toCustomStage", () => {
  it("drops blank rows and blank overrides and parses Vietnamese decimals", () => {
    const values = buildDesignDefaults();
    values.phaseKey = "phase_3";
    values.durationWeeks = "12";
    values.keyFocus = [{ value: " Tăng cơ " }, { value: "" }];
    values.overrides = { weightKg: "65,5", waistCm: "" };

    expect(toCustomStage(values)).toMatchObject({
      phaseKey: "phase_3",
      durationWeeks: 12,
      keyFocus: ["Tăng cơ"],
      weeklySchedule: { sessionMinutes: 60, split: "full_body" },
      overrides: { weightKg: 65.5 },
    });
  });
});

describe("applySuggestion", () => {
  it("fills the content fields but keeps the schedule and overrides", () => {
    const values = { ...buildDesignDefaults(), overrides: { weightKg: "66" } };
    const next = applySuggestion(values, {
      durationWeeks: 9,
      objective: "Gợi ý mục tiêu",
      keyFocus: ["core_control"],
      expectedChanges: ["A"],
      exitCriteria: ["B"],
    });

    expect(next.durationWeeks).toBe("9");
    expect(next.keyFocus).toEqual([{ value: "Cải thiện kiểm soát core" }]);
    expect(next.overrides.weightKg).toBe("66");
    expect(next.weeklySchedule).toEqual(values.weeklySchedule);
  });
});

describe("toPreviewStage", () => {
  it("clamps the weeks and falls back to a default schedule when no day is picked", () => {
    expect(toPreviewStage({ phaseKey: "phase_2", durationWeeks: "30", days: Array(7).fill(false) })).toMatchObject({
      durationWeeks: 16,
      weeklySchedule: { days: [true, false, true, false, true, false, false] },
    });
  });
});
