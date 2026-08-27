import { describe, expect, it, vi } from "vitest";

import {
  RECIPE_NUTRITION_JSON_MAX_SIZE,
  recipeNutritionJsonFileFilter,
} from "../recipeNutritionJsonUpload.js";

describe("recipe nutrition JSON upload boundary", () => {
  it("accepts a JSON file with the expected MIME and extension", () => {
    const callback = vi.fn();

    recipeNutritionJsonFileFilter(
      {},
      {
        originalname: "recipe-nutrition.json",
        mimetype: "application/json",
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
    expect(RECIPE_NUTRITION_JSON_MAX_SIZE).toBe(8 * 1024 * 1024);
  });

  it("rejects a disguised non-JSON file", () => {
    const callback = vi.fn();

    recipeNutritionJsonFileFilter(
      {},
      {
        originalname: "recipe-nutrition.txt",
        mimetype: "application/json",
      },
      callback,
    );

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][1]).toBeUndefined();
  });
});
