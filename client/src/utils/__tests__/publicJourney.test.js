import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRICING_VIEW_MODE,
  GUEST_MEAL_PLAN_PREVIEW_KEY,
  PRICING_VIEW_MODE_KEY,
  hasUsedGuestMealPlanPreview,
  loadPricingViewMode,
  markGuestMealPlanPreviewUsed,
  persistPricingViewMode,
  resolvePricingViewMode,
} from "../publicJourney";

const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("Pricing persona", () => {
  it("mặc định customer và chỉ chấp nhận hai mode hợp lệ", () => {
    expect(resolvePricingViewMode(null)).toBe(DEFAULT_PRICING_VIEW_MODE);
    expect(resolvePricingViewMode("invalid")).toBe(DEFAULT_PRICING_VIEW_MODE);
    expect(resolvePricingViewMode("customer")).toBe("customer");
    expect(resolvePricingViewMode("trainer")).toBe("trainer");
  });

  it("đọc và ghi localStorage theo hướng fail-safe", () => {
    const storage = createStorage({ [PRICING_VIEW_MODE_KEY]: "trainer" });

    expect(loadPricingViewMode(storage)).toBe("trainer");
    expect(persistPricingViewMode("customer", storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      PRICING_VIEW_MODE_KEY,
      "customer",
    );

    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadPricingViewMode(unavailableStorage)).toBe("customer");
    expect(persistPricingViewMode("trainer", unavailableStorage)).toBe(false);
  });
});

describe("anonymous Meal Plan preview", () => {
  it("đánh dấu preview đã dùng trong browser session", () => {
    const storage = createStorage();

    expect(hasUsedGuestMealPlanPreview(storage)).toBe(false);
    expect(markGuestMealPlanPreviewUsed(storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      GUEST_MEAL_PLAN_PREVIEW_KEY,
      "true",
    );
    expect(hasUsedGuestMealPlanPreview(storage)).toBe(true);
  });

  it("không khóa khách khi sessionStorage không khả dụng", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(hasUsedGuestMealPlanPreview(unavailableStorage)).toBe(false);
    expect(markGuestMealPlanPreviewUsed(unavailableStorage)).toBe(false);
  });
});
