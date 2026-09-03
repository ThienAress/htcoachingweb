import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "vi" },
    t: (key, params = {}) => ({
      "detail.nutrition.title": "Dinh dưỡng toàn công thức",
      "detail.nutrition.caption": "Tổng ước tính cho toàn bộ công thức",
      "detail.nutrition.empty": "Công thức này chưa có đủ thông tin dinh dưỡng để hiển thị.",
      "detail.nutrition.warning": "Giá trị chỉ dùng để tham khảo.",
      "detail.nutrition.status_partial": "Một phần nguyên liệu chưa đủ dữ liệu",
      "detail.nutrition.unresolved": `${params.count} nguyên liệu chưa được cộng vào tổng: ${params.items}.`,
      "detail.nutrition.calories": "Năng lượng",
      "detail.nutrition.fibre": "Chất xơ",
      "detail.nutrition.sugars": "Đường",
      "detail.nutrition.value": "Giá trị",
      "detail.nutrition.unit_kcal": "kcal",
      "detail.nutrition.unit_gram": "g",
    })[key] || key,
  }),
}));

import RecipeNutritionPanel from "../RecipeNutritionPanel.jsx";

describe("RecipeNutritionPanel", () => {
  it("does not present unavailable nutrition as zero totals", () => {
    const html = renderToStaticMarkup(
      <RecipeNutritionPanel
        nutrition={{
          status: "unavailable",
          values: {},
          additional: [],
        }}
      />,
    );

    expect(html).toContain("Công thức này chưa có đủ thông tin dinh dưỡng để hiển thị.");
    expect(html).not.toContain("<table");
  });

  it("renders one estimated value column and optional nutrient rows", () => {
    const html = renderToStaticMarkup(
      <RecipeNutritionPanel
        nutrition={{
          status: "available",
          values: {
            calories: 361,
            protein: 25,
            fat: 8,
            carb: 42,
            sugars: 3.2,
            salt: 1,
          },
          additional: [{ label: "Chất xơ", unit: "g", value: 4.5 }],
        }}
      />,
    );

    expect(html).toContain("Năng lượng");
    expect(html).toContain(">361<");
    expect(html).toContain("Chất xơ");
    expect(html).toContain("Đường");
    expect(html).not.toContain("detail.nutrition.minimum");
    expect(html).not.toContain("detail.nutrition.maximum");
  });

  it("keeps internal coverage and unresolved diagnostics out of the customer UI", () => {
    const html = renderToStaticMarkup(
      <RecipeNutritionPanel
        nutrition={{
          status: "available",
          values: { calories: 361 },
          additional: [],
          nutrientCoverage: {
            saturates: { complete: false, includedCount: 1, missingCount: 2 },
          },
          items: [{ name: "Nguyên liệu nội bộ", status: "unresolved" }],
        }}
      />,
    );

    expect(html).toContain("Giá trị chỉ dùng để tham khảo.");
    expect(html.match(/Giá trị chỉ dùng để tham khảo\./g)).toHaveLength(1);
    expect(html).not.toContain("Một phần nguyên liệu chưa đủ dữ liệu");
    expect(html).not.toContain("Nguyên liệu nội bộ");
    expect(html).not.toContain("detail.nutrition.coverage_missing");
    expect(html).not.toContain("detail.nutrition.estimated");
  });

  it("displays legacy mg values as precise gram values", () => {
    const html = renderToStaticMarkup(
      <RecipeNutritionPanel
        nutrition={{
          status: "available",
          values: {
            calories: 361,
            protein: 25,
            fat: 8,
            carb: 42,
            sugars: 3.2,
            salt: 1,
          },
          additional: [
            { label: "Natri", unit: "mg", value: 2000 },
            { label: "Sắt", unit: "mg", value: 5 },
            { label: "Vitamin B12", unit: "mcg", value: 1.2 },
          ],
        }}
      />,
    );

    expect({
      hasConvertedLargeValue: html.includes(">2<"),
      hasConvertedSmallValue: html.includes(">0,005<"),
      gramLabels: html.match(/\(g\)/g)?.length,
      keepsMicrogram: html.includes("(mcg)"),
      keepsMilligram: html.includes("(mg)"),
    }).toEqual({
      hasConvertedLargeValue: true,
      hasConvertedSmallValue: true,
      gramLabels: 7,
      keepsMicrogram: true,
      keepsMilligram: false,
    });
  });
});
