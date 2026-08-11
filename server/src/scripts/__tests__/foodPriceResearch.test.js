import { describe, expect, it } from "vitest";

import {
  FOOD_PRICE_DEFER_REASON,
  assessRetailCandidate,
  buildCatalogCoverageLedger,
  parsePackGrams,
} from "../foodPriceResearch.contract.js";

describe("Food price research unit conversion", () => {
  it("accepts explicit gram and kilogram packs", () => {
    expect(parsePackGrams("Cà chua 300g", "300g", "Cái")).toBe(300);
    expect(parsePackGrams("Cà chua loại I kg", "", "Kg")).toBe(1_000);
    expect(parsePackGrams("Khoai tây túi 1.5kg", "", "Túi")).toBe(1_500);
  });

  it("rejects volume, count-only and ambiguous multipacks", () => {
    expect(parsePackGrams("Dầu olive 500ml", "Chai 500ml", "Chai")).toBeNull();
    expect(parsePackGrams("Trứng gà hộp 10 quả", "10 quả", "Hộp")).toBeNull();
    expect(parsePackGrams("Đậu phụ 2 hộp x 100g", "", "Combo")).toBeNull();
    expect(
      parsePackGrams("Sữa chua thùng 48 hộp 100g", "Hộp 100g", "Thùng"),
    ).toBeNull();
    expect(parsePackGrams("Xúc xích gói 175g", "Cây 35g", "Gói")).toBeNull();
  });
});

describe("Food price retail candidate safety", () => {
  it("accepts a same-form product with an explicit gram basis", () => {
    expect(
      assessRetailCandidate("Cà chua", {
        name: "Cà chua 300g",
        canonical: "300g",
        uomName: "Cái",
      }),
    ).toEqual(expect.objectContaining({ accepted: true, packGrams: 300 }));
  });

  it("rejects processed matches for a plain Food label", () => {
    expect(
      assessRetailCandidate("Cà chua", {
        name: "Cà chua cô đặc 210g",
        canonical: "Hũ 210g",
        uomName: "Hũ",
      }),
    ).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
      }),
    );

    expect(
      assessRetailCandidate("Ba tê", {
        name: "Cá sa ba tẩm sa tế Co.op gói 500g",
        canonical: "Gói 500g",
        uomName: "Gói",
      }),
    ).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
      }),
    );
  });

  it("rejects raw/cooked substitutions and unsafe units", () => {
    expect(
      assessRetailCandidate("Cơm trắng", {
        name: "Gạo trắng túi 5kg",
        canonical: "Túi 5kg",
        uomName: "Túi",
      }),
    ).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: FOOD_PRICE_DEFER_REASON.RAW_COOKED_MISMATCH,
      }),
    );

    expect(
      assessRetailCandidate("Trứng gà", {
        name: "Trứng gà hộp 10 quả",
        canonical: "Hộp 10 quả",
        uomName: "Hộp",
      }),
    ).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE,
      }),
    );
  });
});

describe("production Food price coverage ledger", () => {
  it("requires every production label to be priced or deferred exactly once", () => {
    const result = buildCatalogCoverageLedger({
      productionLabels: ["Cà chua", "Trứng gà", "Cà chua"],
      pricedLabels: ["Cà chua"],
      deferred: [
        {
          foodLabel: "Trứng gà",
          reason: FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE,
        },
      ],
    });

    expect(result).toEqual({ total: 2, priced: 1, deferred: 1 });
  });

  it("rejects overlaps, missing labels and unsupported reasons", () => {
    expect(() =>
      buildCatalogCoverageLedger({
        productionLabels: ["Cà chua"],
        pricedLabels: ["Cà chua"],
        deferred: [
          {
            foodLabel: "Cà chua",
            reason: FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS,
          },
        ],
      }),
    ).toThrow("CATALOG_PRICE_CLASSIFICATION_OVERLAP");

    expect(() =>
      buildCatalogCoverageLedger({
        productionLabels: ["Cà chua", "Trứng gà"],
        pricedLabels: ["Cà chua"],
        deferred: [],
      }),
    ).toThrow("CATALOG_PRICE_CLASSIFICATION_MISSING");

    expect(() =>
      buildCatalogCoverageLedger({
        productionLabels: ["Trứng gà"],
        pricedLabels: [],
        deferred: [{ foodLabel: "Trứng gà", reason: "UNKNOWN" }],
      }),
    ).toThrow("CATALOG_PRICE_DEFER_REASON_INVALID");
  });
});
