import { describe, expect, it } from "vitest";

import {
  MAX_PRICING_GIFTS,
  giftsFromText,
  giftsToText,
  resolvePricingGifts,
  validateGifts,
} from "../pricingGifts";

describe("resolvePricingGifts", () => {
  const defaults = ["Shaker"];

  it("uses the built-in gifts until an admin saves a list", () => {
    expect(resolvePricingGifts(undefined, "1-1-vip", defaults)).toEqual(defaults);
    expect(resolvePricingGifts({}, "1-1-vip", defaults)).toEqual(defaults);
    expect(resolvePricingGifts({ "1-1-basic": ["A"] }, "1-1-vip", defaults)).toEqual(defaults);
  });

  it("uses the saved list, including an empty one meaning no gifts", () => {
    expect(resolvePricingGifts({ "1-1-vip": ["A", "B"] }, "1-1-vip", defaults)).toEqual(["A", "B"]);
    expect(resolvePricingGifts({ "1-1-vip": [] }, "1-1-vip", defaults)).toEqual([]);
  });

  it("defaults to no gifts when nothing is built in", () => {
    expect(resolvePricingGifts({}, "online-basic")).toEqual([]);
  });
});

describe("gift text conversion", () => {
  it("turns one-gift-per-line text into a clean list", () => {
    expect(giftsFromText("  Balo   Degrey \r\n\nShaker\nSHAKER\n")).toEqual(["Balo Degrey", "Shaker"]);
    expect(giftsFromText("")).toEqual([]);
    expect(giftsFromText(undefined)).toEqual([]);
  });

  it("round-trips a list through the editor text", () => {
    expect(giftsFromText(giftsToText(["A", "B"]))).toEqual(["A", "B"]);
    expect(giftsToText(undefined)).toBe("");
  });
});

describe("validateGifts", () => {
  it("allows up to the limit and explains what is wrong beyond it", () => {
    expect(validateGifts(Array.from({ length: MAX_PRICING_GIFTS }, (_, i) => `Q${i}`))).toBe("");
    expect(validateGifts(Array.from({ length: MAX_PRICING_GIFTS + 1 }, (_, i) => `Q${i}`))).toMatch(/tối đa 8 quà/);
    expect(validateGifts(["x".repeat(121)])).toMatch(/tối đa 120 ký tự/);
    expect(validateGifts([])).toBe("");
  });
});
