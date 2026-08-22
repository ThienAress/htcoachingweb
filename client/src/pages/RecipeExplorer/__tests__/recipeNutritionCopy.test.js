import { describe, expect, it } from "vitest";

import en from "../../../i18n/locales/en/recipe.json";
import vi from "../../../i18n/locales/vi/recipe.json";

describe("recipe nutrition copy", () => {
  it("explains that nutrition covers the whole recipe", () => {
    expect(vi.detail.nutrition.warning).toMatch(/toàn bộ công thức, không chia theo khẩu phần/i);
    expect(en.detail.nutrition.warning).toMatch(/full recipe, not per serving/i);
  });

  it("keeps optional nutrient labels available for data-backed rows", () => {
    expect(Object.keys(vi.detail.nutrition)).toEqual(
      expect.arrayContaining(["saturates", "sugars", "fibre", "salt"]),
    );
    expect(Object.keys(en.detail.nutrition)).toEqual(
      expect.arrayContaining(["saturates", "sugars", "fibre", "salt"]),
    );
  });
});
