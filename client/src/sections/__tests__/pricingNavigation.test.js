import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pricing = readFileSync(new URL("../Pricing.jsx", import.meta.url), "utf8");
const fitnessPlusPlans = readFileSync(
  new URL("../../components/Pricing/FitnessPlusPlans.jsx", import.meta.url),
  "utf8",
);

describe("pricing login return navigation", () => {
  it("returns every pricing checkout login flow to the home pricing hash", () => {
    const source = `${pricing}\n${fitnessPlusPlans}`;

    expect(source).not.toContain('from: "/pricing"');
    expect(source.match(/from: "\/#pricing"/g)).toHaveLength(3);
  });
});
