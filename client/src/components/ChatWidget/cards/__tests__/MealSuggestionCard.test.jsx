import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MealSuggestionCard from "../MealSuggestionCard";

const data = {
  targetCalories: 2500,
  macros: { protein: 170, carb: 280, fat: 78 },
  meals: [{
    label: "Bữa sáng",
    foods: [{ name: "Ức gà", calories: 300 }],
  }],
};

describe("MealSuggestionCard", () => {
  it("hiển thị cảnh báo nhãn sản phẩm khi chỉ có bằng chứng thành phần", () => {
    const html = renderToStaticMarkup(<MealSuggestionCard data={{
      ...data,
      safety: {
        status: "ingredient_verified",
        crossContactStatus: "product_label_required",
        warning: "Hãy kiểm tra nhãn sản phẩm vì nguy cơ nhiễm chéo.",
      },
    }} />);

    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Lưu ý dị ứng"');
    expect(html).toContain("kiểm tra nhãn sản phẩm");
  });

  it("không tạo vùng cảnh báo rỗng khi user không yêu cầu dị ứng", () => {
    const html = renderToStaticMarkup(<MealSuggestionCard data={data} />);

    expect(html).not.toContain('aria-label="Lưu ý dị ứng"');
  });
});
