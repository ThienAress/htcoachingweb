import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn() },
}));

import api from "../../utils/api";
import { analyzeMeal } from "../mealScan.service.js";

describe("mealScan service", () => {
  beforeEach(() => vi.clearAllMocks());

  test("posts the compressed image through the shared axios client", async () => {
    const result = { mealName: "Cơm gà" };
    const quota = {
      serviceKey: "meal_scan",
      tier: "user",
      limit: 3,
      remaining: 2,
      resetAt: "2026-08-08T00:00:00.000Z",
    };
    api.post.mockResolvedValueOnce({
      data: { success: true, data: result, meta: { quota } },
    });

    await expect(
      analyzeMeal("data:image/webp;base64,YQ==", "vi", [
        { name: "Dầu ô liu", grams: 15 },
      ]),
    ).resolves.toEqual({ result, quota });
    expect(api.post).toHaveBeenCalledWith("/meal-scans/analyze", {
      image: "data:image/webp;base64,YQ==",
      locale: "vi",
      declaredIngredients: [{ name: "Dầu ô liu", grams: 15 }],
    });
  });

  test("fails closed when the API response envelope is invalid", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await expect(
      analyzeMeal("data:image/webp;base64,YQ==", "vi", [
        { name: "Dầu ô liu", grams: 15 },
      ]),
    ).rejects.toThrow("Kết quả phân tích không hợp lệ");
  });
});
