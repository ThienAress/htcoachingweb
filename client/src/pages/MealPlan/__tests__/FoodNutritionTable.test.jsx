import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => ({
      "table.food": "Thực phẩm",
      "table.portion": "Khẩu phần",
      "table.protein": "Protein",
      "table.carb": "Carb",
      "table.fat": "Fat",
      "table.calories": "Calo",
      "table.price": "Giá / 100g",
      "table.price_note": "Giá chỉ là ước tính và có thể thay đổi theo nơi bán.",
      "table.nutrition_source_note": "Giá trị dinh dưỡng tham khảo từ Viện Dinh dưỡng Quốc gia.",
    })[key] || key,
  }),
}));

import FoodNutritionTable from "../FoodNutritionTable";

describe("FoodNutritionTable", () => {
  it("hiển thị giá mỗi 100g, dấu gạch khi thiếu và hai ghi chú đã chốt", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FoodNutritionTable
          foodDatabase={[
            {
              _id: "priced",
              label: "Ức gà",
              protein: 31,
              carb: 0,
              fat: 3.6,
              marketPrice: {
                coverageStatus: "sufficient",
                typicalVndPer100g: 20_000,
              },
            },
            {
              _id: "unpriced",
              label: "Cơm trắng",
              protein: 2.7,
              carb: 28,
              fat: 0.3,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect([
      html.includes("Giá / 100g"),
      html.includes("20.000đ"),
      html.includes(">—<"),
      html.includes("Giá chỉ là ước tính và có thể thay đổi theo nơi bán."),
      html.includes("Giá trị dinh dưỡng tham khảo từ Viện Dinh dưỡng Quốc gia."),
    ]).toEqual([true, true, true, true, true]);
  });
});
