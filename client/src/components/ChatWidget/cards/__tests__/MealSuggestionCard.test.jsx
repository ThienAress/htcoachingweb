import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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

const renderCard = (cardData, props = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <MealSuggestionCard data={cardData} {...props} />
    </MemoryRouter>,
  );

describe("MealSuggestionCard", () => {
  it("hiển thị cảnh báo nhãn sản phẩm khi chỉ có bằng chứng thành phần", () => {
    const html = renderCard({
      ...data,
      safety: {
        status: "ingredient_verified",
        crossContactStatus: "product_label_required",
        warning: "Hãy kiểm tra nhãn sản phẩm vì nguy cơ nhiễm chéo.",
      },
    });

    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Lưu ý dị ứng"');
    expect(html).toContain("kiểm tra nhãn sản phẩm");
  });

  it("không tạo vùng cảnh báo rỗng khi user không yêu cầu dị ứng", () => {
    const html = renderCard(data);

    expect(html).not.toContain('aria-label="Lưu ý dị ứng"');
  });

  it("hiển thị nhãn một bữa cho scope per_meal", () => {
    const html = renderCard({ ...data, targetCalories: 650, calorieScope: "per_meal" });
    expect(html).toContain("Một bữa");
    expect(html).not.toContain("Một ngày · 1 bữa");
  });

  it("cho chọn đúng một food item và giữ nút đổi món ở footer", () => {
    const html = renderCard(
      {
        ...data,
        mealPlanId: "11111111-1111-4111-8111-111111111111",
        mealRevision: 2,
        meals: [
          {
            label: "Bữa sáng",
            foods: [
              {
                foodId: "chicken",
                name: "Ức gà",
                amountGrams: 180,
                calories: 300,
              },
              {
                foodId: "rice",
                name: "Cơm trắng",
                amountGrams: 220,
                calories: 280,
              },
            ],
          },
        ],
      },
      { conversationId: "conversation-1" },
    );

    expect(html).toContain("Đổi món tương đương");
    expect(html).toContain("Đang chọn: Ức gà");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("min-h-11");
  });

});
