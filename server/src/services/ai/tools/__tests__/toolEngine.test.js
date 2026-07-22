import { describe, expect, it } from "vitest";

import { executeTool } from "../toolEngine.js";

describe("AI tool runtime validation", () => {
  it("rejects out-of-range arguments before executing a tool", async () => {
    const result = await executeTool(
      "calculate_tdee",
      {
        gender: "male",
        age: 999,
        heightCm: 175,
        weightKg: 70,
        activityLevel: "moderate",
        goal: "maintenance",
      },
      {},
    );

    expect(result.meta.validationFailed).toBe(true);
    expect(result.meta.invalidFields).toContain("age");
  });

  it("rejects additional properties supplied by the model", async () => {
    const result = await executeTool(
      "search_exercises",
      { muscleGroup: "Ngực", limit: 5, injected: true },
      {},
    );

    expect(result.meta.validationFailed).toBe(true);
    expect(result.meta.invalidFields).toContain("parameters");
  });
});
