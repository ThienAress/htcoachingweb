import { describe, expect, it } from "vitest";
import {
  SPLIT_OPTIONS,
  getShortPlanHint,
  daysFromCount,
  applyContentSuggestion,
  applySuggestion,
  buildDesignDefaults,
  getSplitLabel,
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
    expect(next.keyFocus).toEqual([{ value: "Cải thiện kiểm soát cơ lõi" }]);
    expect(next.overrides.weightKg).toBe("66");
    expect(next.weeklySchedule).toEqual(values.weeklySchedule);
  });
});

describe("toPreviewStage", () => {
  it("clamps the weeks to 4-24 and falls back to a default schedule when no day is picked", () => {
    expect(toPreviewStage({ phaseKey: "phase_2", durationWeeks: "30", days: Array(7).fill(false) })).toMatchObject({
      durationWeeks: 24,
      weeklySchedule: { days: [true, false, true, false, true, false, false] },
    });
  });
});

describe("training methods", () => {
  it("offers the five methods in order", () => {
    expect(SPLIT_OPTIONS.map((item) => item.label)).toEqual([
      "Full Body Workout",
      "Upper / Lower",
      "Push / Pull",
      "Push–Pull–Legs (PPL)",
      "Tự đặt",
    ]);
  });

  it("keeps the custom name only for the custom method and shows it as the label", () => {
    const base = buildDesignDefaults();
    base.weeklySchedule.customSplitName = " Cardio + Core ";

    base.weeklySchedule.split = "custom";
    expect(toCustomStage(base).weeklySchedule).toMatchObject({ split: "custom", customSplitName: "Cardio + Core" });
    expect(getSplitLabel({ split: "custom", customSplitName: "Cardio + Core" })).toBe("Cardio + Core");
    expect(getSplitLabel({ split: "custom" })).toBe("Tự đặt");

    base.weeklySchedule.split = "push_pull";
    expect(toCustomStage(base).weeklySchedule).not.toHaveProperty("customSplitName");
    expect(getSplitLabel({ split: "push_pull" })).toBe("Push / Pull");
  });
});

describe("applyContentSuggestion", () => {
  it("fills only the three content lists and keeps the weeks, objective and reason the trainer typed", () => {
    const values = { ...buildDesignDefaults(), durationWeeks: "24", objective: "Mục tiêu của HLV", entryReason: "Lý do của HLV" };
    const next = applyContentSuggestion(values, {
      durationWeeks: 8,
      objective: "Gợi ý mục tiêu",
      entryReason: "Gợi ý lý do",
      keyFocus: ["core_control"],
      expectedChanges: ["A"],
      exitCriteria: ["B"],
    });

    expect(next.durationWeeks).toBe("24");
    expect(next.objective).toBe("Mục tiêu của HLV");
    expect(next.entryReason).toBe("Lý do của HLV");
    expect(next.keyFocus).toHaveLength(1);
    expect(next.expectedChanges).toEqual([{ value: "A" }]);
    expect(next.exitCriteria).toEqual([{ value: "B" }]);
  });
});

describe("schedule defaults from the client profile", () => {
  it("spreads the profile's training days across the week", () => {
    const count = (days) => days.filter(Boolean).length;
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(count(daysFromCount(n))).toBe(n);
    expect(daysFromCount(5)).toEqual([true, true, true, true, true, false, false]);
    expect(daysFromCount(3)).toEqual([true, false, true, false, true, false, false]);
    expect(daysFromCount(0)).toBeNull();
    expect(daysFromCount("")).toBeNull();
    expect(daysFromCount(9)).toBeNull();
  });

  it("uses the profile days and minutes when no schedule was saved, else the saved schedule", () => {
    const fromProfile = buildDesignDefaults({ training: { trainingDaysPerWeek: 5, sessionDurationMinutes: 75 } });
    expect(fromProfile.weeklySchedule.days.filter(Boolean)).toHaveLength(5);
    expect(fromProfile.weeklySchedule.sessionMinutes).toBe("75");

    const saved = buildDesignDefaults({
      plan: { weeklySchedule: { days: [true, false, true, false, true, false, false], sessionMinutes: 45 } },
      training: { trainingDaysPerWeek: 5, sessionDurationMinutes: 75 },
    });
    expect(saved.weeklySchedule.days.filter(Boolean)).toHaveLength(3);
    expect(saved.weeklySchedule.sessionMinutes).toBe("45");

    const none = buildDesignDefaults({ training: { trainingDaysPerWeek: "", sessionDurationMinutes: 5 } });
    expect(none.weeklySchedule.days.filter(Boolean)).toHaveLength(3);
    expect(none.weeklySchedule.sessionMinutes).toBe("60");
  });
});

describe("default weeks stay inside the allowed range", () => {
  it("raises a short system extension to 4 weeks and caps the long ones at 24", () => {
    expect(buildDesignDefaults({ plan: { durationWeeks: 2 } }).durationWeeks).toBe("4");
    expect(buildDesignDefaults({ plan: { durationWeeks: 30 } }).durationWeeks).toBe("24");
    expect(buildDesignDefaults({ plan: { durationWeeks: 12 } }).durationWeeks).toBe("12");
    expect(buildDesignDefaults().durationWeeks).toBe("8");
  });

  it("explains the raise only when the plan is shorter than the minimum", () => {
    expect(getShortPlanHint({ durationWeeks: 2 })).toContain("Hệ thống đề xuất 2 tuần");
    expect(getShortPlanHint({ durationWeeks: 4 })).toBe("");
    expect(getShortPlanHint(null)).toBe("");
  });
});
