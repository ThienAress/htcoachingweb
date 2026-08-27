import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../../utils/api";
import {
  commitRecipeNutritionImport,
  previewRecipeNutritionImport,
} from "../recipe.service";

describe("recipe service", () => {
  beforeEach(() => {
    api.post.mockReset();
    api.post.mockResolvedValue({ data: { success: true } });
  });

  it("uses the same multipart contract for nutrition preview and commit", async () => {
    const file = new File(["{}"], "recipe-nutrition.json", {
      type: "application/json",
    });

    await previewRecipeNutritionImport(file);
    await commitRecipeNutritionImport(file, "preview-token");

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/recipes/nutrition/import",
      expect.any(FormData),
    );
    expect(api.post.mock.calls[0][1].get("file")).toBe(file);
    expect(api.post.mock.calls[0][1].get("dryRun")).toBe("true");
    expect(api.post.mock.calls[1][1].get("file")).toBe(file);
    expect(api.post.mock.calls[1][1].get("dryRun")).toBe("false");
    expect(api.post.mock.calls[1][1].get("previewToken")).toBe(
      "preview-token",
    );
  });
});
