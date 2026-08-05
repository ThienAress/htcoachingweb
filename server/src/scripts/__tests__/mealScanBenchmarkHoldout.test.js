import { describe, expect, test } from "vitest";

import { selectBenchmarkIds } from "../mealScanBenchmarkDataset.js";

describe("meal scan benchmark holdout selection", () => {
  test("excludes every dish used by the baseline report", () => {
    const selected = selectBenchmarkIds(
      ["dish_a", "dish_b", "dish_c", "dish_d", "dish_e"],
      2,
      new Set(["dish_a", "dish_c", "dish_e"]),
    );

    expect(selected).toEqual(["dish_b", "dish_d"]);
  });
});
