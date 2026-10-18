import { describe, expect, it } from "vitest";

import {
  buildDefaultPricingContent,
  resolveLoginPromo,
  resolvePricingContent,
  validateBenefits,
} from "../pricingContent";

const t = (key) => key;

describe("pricing content defaults", () => {
  it("starts the ONLINE list with the online line and the other tabs with one-on-one", () => {
    const defaults = buildDefaultPricingContent(t);

    expect(defaults["online-customer"][0]).toBe("pricing.features.online");
    expect(defaults["1-1-customer"][0]).toBe("pricing.features.one_on_one");
    expect(defaults["trial-customer"][0]).toBe("pricing.features.one_on_one");
    expect(defaults["1-1-customer"]).toHaveLength(7);
    expect(defaults["1-1-system"]).toHaveLength(5);
  });

  it("uses a saved list when there is one and falls back to the default otherwise", () => {
    expect(resolvePricingContent({ "1-1-system": ["A"] }, "1-1-system", ["X"])).toEqual(["A"]);
    expect(resolvePricingContent({}, "1-1-system", ["X"])).toEqual(["X"]);
    expect(resolvePricingContent({ "1-1-system": [] }, "1-1-system", ["X"])).toEqual(["X"]);
  });
});

describe("login promo", () => {
  it("is on at 15 percent until an admin saves something else", () => {
    expect(resolveLoginPromo(undefined)).toEqual({ enabled: true, percent: 15 });
    expect(resolveLoginPromo({ loginPromo: { enabled: false, percent: 30 } })).toEqual({
      enabled: false,
      percent: 30,
    });
    expect(resolveLoginPromo({ loginPromo: { enabled: "no", percent: "x" } })).toEqual({
      enabled: true,
      percent: 15,
    });
  });
});

describe("benefit validation", () => {
  it("accepts 1 to 12 lines up to 160 characters", () => {
    expect(validateBenefits(["a"])).toBe("");
    expect(validateBenefits(Array.from({ length: 12 }, (_, i) => `q${i}`))).toBe("");
  });

  it("refuses an empty list, too many lines and an over-long line", () => {
    expect(validateBenefits([])).toMatch(/ít nhất một/);
    expect(validateBenefits(Array.from({ length: 13 }, (_, i) => `q${i}`))).toMatch(/tối đa 12/);
    expect(validateBenefits(["x".repeat(161)])).toMatch(/tối đa 160/);
  });
});
