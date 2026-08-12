import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    delete: vi.fn(),
  },
}));

import api from "../../utils/api";
import { deleteMyMealPlanPreferences } from "../user.service";

describe("user service Meal Plan preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the owner-only delete route and unwraps the empty contract", async () => {
    const data = {
      allergyStatus: null,
      allergens: [],
      otherAllergenText: "",
      budgetVndPerDay: null,
      reviewedAt: null,
    };
    api.delete.mockResolvedValue({ data: { success: true, data } });

    await expect(deleteMyMealPlanPreferences()).resolves.toEqual(data);
    expect(api.delete).toHaveBeenCalledWith("/user/me/meal-plan-preferences");
  });
});
