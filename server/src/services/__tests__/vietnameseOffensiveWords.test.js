import { describe, expect, it } from "vitest";

import {
  containsVietnameseOffensiveTerm,
  vietnameseOffensiveTerms,
} from "../vietnameseOffensiveWords.service.js";

describe("Vietnamese offensive words snapshot", () => {
  it("loads upstream variants while ignoring comments and delimiters", () => {
    expect(vietnameseOffensiveTerms).toContain("xhct");
    expect(vietnameseOffensiveTerms).toContain("đầu bòy");
    expect(vietnameseOffensiveTerms.some((term) => term.startsWith("#"))).toBe(
      false,
    );
  });

  it.each(["Thực đơn XHCT", "Bữa ĐẦU BÒY", "Món  địt   mẹ"])(
    "detects a normalized upstream variant: %s",
    (value) => {
      expect(containsVietnameseOffensiveTerm(value)).toBe(true);
    },
  );

  it.each([
    "Thực đơn cacao",
    "Bữa cơm nguội",
    "Salad avocado",
    "Cơm cá cho ngày tập",
    "Thuc don cac mon ga",
    "Bua ngu ngon",
    "Thuc don ca ngu",
    "Thuc don cu cai",
  ])("does not block a harmless substring: %s", (value) => {
    expect(containsVietnameseOffensiveTerm(value)).toBe(false);
  });
});
