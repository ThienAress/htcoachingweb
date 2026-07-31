import { describe, expect, it } from "vitest";
import {
  buildTargetComparisons,
  getWellnessTargetSubmitLabel,
  targetToFormValues,
  waterLitersToMl,
  wellnessTargetFormSchema,
} from "../wellnessTarget";

const target = {
  targets: { sleepHours: 8, waterMl: 2500, steps: 8000 },
};

describe("wellness target presentation", () => {
  it("compares only sleep, water and steps without evaluating subjective fields", () => {
    const result = buildTargetComparisons(target, {
      sleepHours: 6,
      waterMl: 2500,
      steps: null,
      stress: 9,
      hunger: 2,
    });

    expect(result.map((item) => item.key)).toEqual([
      "sleepHours",
      "waterMl",
      "steps",
    ]);
    expect(result.map((item) => item.percent)).toEqual([75, 100, null]);
  });

  it("caps the visual bar at 100 percent without labeling success or failure", () => {
    const [sleep] = buildTargetComparisons(target, { sleepHours: 10 });

    expect(sleep.percent).toBe(100);
    expect(sleep.actualLabel).toBe("10 / 8 giờ");
  });

  it("normalizes valid form strings into canonical numbers", () => {
    const result = wellnessTargetFormSchema.parse({
      sleepHours: "7.5",
      waterLiters: "2.5",
      steps: "8000",
      note: "Mục tiêu tháng đầu",
    });

    expect(result).toEqual({
      sleepHours: 7.5,
      waterLiters: 2.5,
      steps: 8000,
      note: "Mục tiêu tháng đầu",
    });
  });

  it("converts between the liters form and canonical milliliters", () => {
    expect({
      formLiters: targetToFormValues(target).waterLiters,
      payloadMl: waterLitersToMl(2.5),
    }).toEqual({ formLiters: 2.5, payloadMl: 2500 });
  });

  it("rejects a zero water target", () => {
    const result = wellnessTargetFormSchema.safeParse({
      sleepHours: 7,
      waterLiters: 0,
      steps: 8000,
      note: "",
    });

    expect(result.success).toBe(false);
  });
  it("uses update copy after a target already exists", () => {
    expect(getWellnessTargetSubmitLabel(null, false)).toBe("Lưu mục tiêu");
    expect(getWellnessTargetSubmitLabel(target, false)).toBe("Cập nhật mục tiêu");
    expect(getWellnessTargetSubmitLabel(target, true)).toBe("Đang cập nhật...");
  });
});
