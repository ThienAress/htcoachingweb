import { describe, expect, it } from "vitest";

import {
  MAX_PRICING_GIFTS,
  MAX_PRICING_GIFT_LENGTH,
  isPricingGiftKey,
  normalizePricingGifts,
} from "../pricingGifts.js";

describe("pricing gift keys", () => {
  it("accepts only the fixed tab and plan keys", () => {
    expect(isPricingGiftKey("1-1-vip")).toBe(true);
    expect(isPricingGiftKey("trial")).toBe(true);
    for (const key of ["", "vip", "1-1", "__proto__", "constructor", "1-1-basic ", null, undefined, 7]) {
      expect(isPricingGiftKey(key)).toBe(false);
    }
  });
});

describe("normalizePricingGifts", () => {
  it("trims, collapses spaces, drops blank lines and case-insensitive duplicates", () => {
    expect(
      normalizePricingGifts(["  Shaker   600ml ", "", "   ", "shaker 600ml", "Balo Degrey"]),
    ).toEqual({ gifts: ["Shaker 600ml", "Balo Degrey"] });
  });

  it("allows an empty list so a plan can have no gifts", () => {
    expect(normalizePricingGifts([])).toEqual({ gifts: [] });
  });

  it("rejects anything that is not a list of strings", () => {
    for (const bad of [undefined, null, "Shaker", { 0: "x" }, [1], [null], [["x"]]]) {
      expect(normalizePricingGifts(bad)).toHaveProperty("error");
    }
  });

  it("rejects a gift that is too long and a list that is too long", () => {
    expect(normalizePricingGifts(["x".repeat(MAX_PRICING_GIFT_LENGTH + 1)])).toHaveProperty("error");
    expect(normalizePricingGifts(["x".repeat(MAX_PRICING_GIFT_LENGTH)])).toHaveProperty("gifts");

    const tooMany = Array.from({ length: MAX_PRICING_GIFTS + 1 }, (_, index) => `Quà ${index}`);
    expect(normalizePricingGifts(tooMany)).toHaveProperty("error");
    expect(normalizePricingGifts(tooMany.slice(0, MAX_PRICING_GIFTS))).toHaveProperty("gifts");
  });

  it("does not count blank lines or repeats against the limit", () => {
    const list = [...Array.from({ length: MAX_PRICING_GIFTS }, (_, i) => `Quà ${i}`), "", "quà 0"];
    expect(normalizePricingGifts(list).gifts).toHaveLength(MAX_PRICING_GIFTS);
  });
});
