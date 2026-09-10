import { describe, expect, it } from "vitest";
import { weeklyFormSchema, weeklyValuesToPatch, checkinToWeeklyValues } from "../weeklyCheckinForm";
import { bodyProgressHistoryRows, progressSectionHasData } from "../progressPresentation";

describe("weekly circumference public form and progress contract", () => {
  it("keeps null and missing fields optional and excludes derived values from writes", () => {
    const values = weeklyFormSchema.parse({ waistCm: "80", hipCm: "100", abdomenCm: null });
    expect(weeklyValuesToPatch(values).body).toEqual({ weightKg: null, waistCm: 80, hipCm: 100, abdomenCm: null, bodyFatPercent: null, skeletalMusclePercent: null });
  });
  it.each(["29", "301", "no", Infinity])("rejects an invalid circumference %s", (hipCm) => {
    expect(weeklyFormSchema.safeParse({ hipCm }).success).toBe(false);
  });
  it("shows legacy fields as blank, not zero", () => {
    expect(checkinToWeeklyValues({ body: { waistCm: 80 } })).toMatchObject({ hipCm: "", abdomenCm: "" });
  });
  it("recognizes hip-only progress and never derives a ratio by joining dates", () => {
    const bodyProgress = {
      waistCm: { series: [{ dateKey: "2026-09-01", value: 80 }] },
      hipCm: { series: [{ dateKey: "2026-09-08", value: 100 }] },
    };
    expect(progressSectionHasData("body", { bodyProgress: { hipCm: bodyProgress.hipCm } })).toBe(true);
    expect(bodyProgressHistoryRows(bodyProgress).map(({ hipCm, waistHipRatio }) => ({ hipCm, waistHipRatio })))
      .toEqual([{ hipCm: null, waistHipRatio: null }, { hipCm: 100, waistHipRatio: null }]);
  });
});
