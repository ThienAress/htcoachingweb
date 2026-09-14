import { describe, expect, it, vi } from "vitest";

import { persistOptimisticFeedback } from "../feedbackRuntime";

describe("HT Assistant feedback runtime", () => {
  it("rolls optimistic feedback back when persistence rejects", async () => {
    const applied = [];
    const failure = new Error("network down");

    await expect(
      persistOptimisticFeedback({
        previous: "up",
        next: "down",
        apply: (value) => applied.push(value),
        persist: vi.fn().mockRejectedValue(failure),
      }),
    ).rejects.toBe(failure);

    expect(applied).toEqual(["down", "up"]);
  });

  it("keeps optimistic feedback after persistence succeeds", async () => {
    const applied = [];

    await persistOptimisticFeedback({
      previous: null,
      next: "up",
      apply: (value) => applied.push(value),
      persist: vi.fn().mockResolvedValue(undefined),
    });

    expect(applied).toEqual(["up"]);
  });
});
