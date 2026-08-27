import { describe, expect, it } from "vitest";
import {
  getMissingWellnessFields,
  journalToWellnessValues,
  wellnessSemanticLabel,
  wellnessSemanticValue,
  wellnessFormSchema,
  wellnessValuesToPatch,
} from "../wellness";

describe("wellness form contract", () => {
  it("lists only the optional health fields that the customer left empty", () => {
    expect(
      getMissingWellnessFields({
        ...journalToWellnessValues(null),
        hunger: 6,
        stress: 9,
        soreness: 3,
      }),
    ).toEqual([
      { key: "energy", label: "Năng lượng" },
      { key: "pain", label: "Mức đau" },
    ]);
  });

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
      notes: { private: "Dữ liệu cũ", shared: "Chia sẻ" },
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
      notes: { shared: "Chia sẻ" },
    });
    expect(values).not.toHaveProperty("privateNote");
    expect(patch.notes).not.toHaveProperty("private");
  });

  it("groups legacy ratings into three semantic choices", () => {
    expect([
      wellnessSemanticValue("energy", 1),
      wellnessSemanticValue("energy", 5),
      wellnessSemanticValue("energy", 10),
      wellnessSemanticValue("pain", 4),
      wellnessSemanticValue("energy", ""),
    ]).toEqual([3, 6, 9, 0, null]);
  });

  it("keeps semantic labels specific to each wellness field", () => {
    expect([
      wellnessSemanticLabel("energy", 3),
      wellnessSemanticLabel("hunger", 6),
      wellnessSemanticLabel("pain", 9),
    ]).toEqual(["Cạn kiệt", "Đói vừa", "Đau nhiều"]);
  });

  it("labels legacy values without changing the stored form value", () => {
    const values = journalToWellnessValues({
      wellness: { energy: 4, hunger: 7, stress: 8, pain: 2 },
    });

    expect([
      wellnessSemanticLabel("energy", values.energy),
      wellnessSemanticLabel("hunger", values.hunger),
      wellnessSemanticLabel("stress", values.stress),
      wellnessSemanticLabel("pain", values.pain),
    ]).toEqual(["Cạn kiệt", "Đói vừa", "Rất căng thẳng", "Không đau"]);
  });
});
