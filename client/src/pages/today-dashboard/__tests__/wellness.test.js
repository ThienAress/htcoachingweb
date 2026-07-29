import { describe, expect, it } from "vitest";
import {
  journalToWellnessValues,
  wellnessFormSchema,
  wellnessValuesToPatch,
} from "../wellness";

describe("wellness form contract", () => {
  it("normalizes empty numeric inputs to null", () => {
    const parsed = wellnessFormSchema.parse({
      sleepHours: "",
      waterMl: "",
      steps: "",
      energy: "",
      hunger: "",
      stress: "",
      soreness: "",
      pain: "",
      painArea: "",
      privateNote: "",
      sharedNote: "",
    });

    expect(parsed.sleepHours).toBeNull();
    expect(parsed.pain).toBeNull();
  });

  it("rejects pain outside the 0-10 safety scale", () => {
    const result = wellnessFormSchema.safeParse({
      ...journalToWellnessValues(null),
      pain: "11",
    });

    expect(result.success).toBe(false);
  });

  it("maps journal data to an allowlisted API patch", () => {
    const values = journalToWellnessValues({
      wellness: {
        sleepHours: 7.5,
        waterMl: 2000,
        steps: 8000,
        energy: 8,
        hunger: 4,
        stress: 3,
        soreness: 5,
        pain: 2,
        painArea: "Vai",
      },
      notes: { private: "Riêng", shared: "Chia sẻ" },
    });
    const patch = wellnessValuesToPatch(values);

    expect(patch).toEqual({
      wellness: {
        sleepHours: 7.5,
        waterMl: 2000,
        steps: 8000,
        energy: 8,
        hunger: 4,
        stress: 3,
        soreness: 5,
        pain: 2,
        painArea: "Vai",
      },
      notes: { private: "Riêng", shared: "Chia sẻ" },
    });
  });
});
