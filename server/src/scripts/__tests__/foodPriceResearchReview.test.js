import { describe, expect, it } from "vitest";

import { FOOD_PRICE_DEFER_REASON } from "../foodPriceResearch.contract.js";
import {
  foodPriceDeferReasonLabel,
  toSafeCsvCell,
} from "../foodPriceResearchExport.js";
import { reviewFoodPriceResearch } from "../foodPriceResearchReview.js";

const observation = (foodLabel, sourceKey = "bach_hoa_xanh") => [
  { foodLabel, sourceKey },
];

describe("manual Food price research review", () => {
  it("keeps one approved source, preserves existing reviewed prices and defers false positives", () => {
    const reviewed = reviewFoodPriceResearch({
      report: {
        results: [
          {
            foodLabel: "Bánh bao nhân thịt",
            status: "priced",
            observations: observation("Bánh bao nhân thịt"),
          },
          {
            foodLabel: "Ba tê",
            status: "priced",
            observations: observation("Ba tê"),
          },
          {
            foodLabel: "Bún",
            status: "deferred",
            reason: FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS,
          },
        ],
      },
      approvedLabels: ["Bánh bao nhân thịt"],
      existingObservations: observation("Bún", "coop_online"),
    });

    expect(reviewed.coverage).toEqual({ total: 3, priced: 2, deferred: 1 });
    expect(reviewed.pricedLabels).toEqual(["Bánh bao nhân thịt", "Bún"]);
    expect(reviewed.observations).toHaveLength(2);
    expect(reviewed.deferred).toEqual([
      {
        foodLabel: "Ba tê",
        reason: FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
      },
    ]);
  });

  it("rejects an approval that has no one-source machine candidate", () => {
    expect(() =>
      reviewFoodPriceResearch({
        report: {
          results: [
            {
              foodLabel: "Bún",
              status: "deferred",
              reason: FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS,
            },
          ],
        },
        approvedLabels: ["Bún"],
        existingObservations: [],
      }),
    ).toThrow("FOOD_PRICE_REVIEW_APPROVAL_MISSING_SOURCE:Bún");
  });
});

describe("Food price research CSV handoff", () => {
  it("uses Vietnamese defer copy and neutralizes spreadsheet formulas", () => {
    expect(
      foodPriceDeferReasonLabel(
        FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE,
      ),
    ).toBe("Không đủ căn cứ quy đổi về gram");
    expect(toSafeCsvCell("=1+1")).toBe("'=1+1");
  });
});
