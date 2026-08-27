import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, values = {}) =>
      ({
        "builder.meal_header": "Bữa ăn",
        "builder.carb": "Tinh bột",
        "builder.protein": "Đạm",
        "builder.fat": "Chất béo",
        "builder.calories": "Calo",
      })[key] || key,
  }),
}));

import MealTable from "../MealTable";

const food = (label, amount, typicalVndPer100g = null) => ({
  label,
  amount,
  protein: 10,
  carb: 10,
  fat: 5,
  marketPrice:
    typicalVndPer100g == null
      ? undefined
      : {
          coverageStatus: "sufficient",
          typicalVndPer100g,
        },
});

describe("MealTable", () => {
  it("chỉ hiển thị thực phẩm, macro và calo; không hiển thị tổng chi phí", () => {
    const html = renderToStaticMarkup(
      <MealTable
        meals={[
          {
            mealName: "Bữa 1",
            carbFood: food("Cơm", 100, 10_000),
            proteinFood: food("Ức gà", 150, 20_000),
            fatFood: food("Dầu olive", 10, 30_000),
          },
          {
            mealName: "Bữa 2",
            carbFood: food("Khoai", 50, 20_000),
            proteinFood: food("Cá", 100),
            fatFood: food("Hạt", 20),
          },
        ]}
      />,
    );

    expect(html).toContain("Calo");
    expect(html).not.toContain("Tổng tiền / bữa");
    expect(html).not.toContain("Tổng ngày");
    expect(html).not.toMatch(/\d+[.]\d{3}đ/u);
  });

  it("giữ trạng thái rỗng khi chưa có thực đơn", () => {
    const html = renderToStaticMarkup(
      <MealTable meals={[]} />,
    );

    expect(html).toContain("table.no_menu_yet");
    expect(html).not.toContain("Tổng ngày");
  });

  it("places the save action in the table footer after the last meal", () => {
    const html = renderToStaticMarkup(
      <MealTable
        meals={[
          {
            mealName: "Bữa 1",
            carbFood: food("Cơm", 100),
            proteinFood: food("Ức gà", 150),
            fatFood: food("Dầu olive", 10),
          },
        ]}
        footerAction={<button type="button">Lưu thực đơn hiện tại</button>}
      />,
    );

    expect(html.indexOf("Bữa 1")).toBeLessThan(
      html.indexOf("Lưu thực đơn hiện tại"),
    );
    expect(html).toContain("<tfoot>");
  });
});
