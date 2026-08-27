import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlannedMealExecution } from "../PlannedMealExecution";

describe("PlannedMealExecution", () => {
  it("shows grams, macro and calories for every food plus meal macro totals", () => {
    const html = renderToStaticMarkup(
      <PlannedMealExecution
        plan={{
          meals: [
            {
              key: "meal-1",
              name: "Bữa 1",
              foods: [
                {
                  label: "Mề gà",
                  amountGrams: 200,
                  nutrition: { protein: 6, carb: 40, fat: 1, calories: 193 },
                },
                {
                  label: "Cơm trắng",
                  amountGrams: 300,
                  nutrition: { protein: 4, carb: 5, fat: 1, calories: 45 },
                },
              ],
              totals: { protein: 10, carb: 45, fat: 2, calories: 238 },
            },
          ],
        }}
        entries={[]}
        disabled={false}
        onStatus={() => {}}
      />,
    );

    expect(html).toContain("200g Mề gà");
    expect(html).toContain("6P/40C/1F");
    expect(html).toContain("193 kcal");
    expect(html).toContain("300g Cơm trắng");
    expect(html).toContain("Tổng: 10P | 45C | 2F");
    expect(html).toContain("Bữa 1 — 238 kcal");
  });

  it("shows only eaten totals, target comparison and an adjustment action", () => {
    const html = renderToStaticMarkup(
      <PlannedMealExecution
        plan={{
          meals: [
            {
              key: "meal-1",
              name: "Bữa 1",
              foods: [],
              totals: { protein: 47.1, carb: 23.2, fat: 10.6, calories: 377 },
            },
            {
              key: "meal-2",
              name: "Bữa 2",
              foods: [],
              totals: { protein: 46.4, carb: 25, fat: 11.5, calories: 389 },
            },
          ],
        }}
        entries={[
          {
            entryId: "entry-1",
            mode: "follow_plan",
            plannedMealKey: "meal-1",
            status: "eaten",
            actualTotals: {
              protein: 40,
              carb: 20,
              fat: 9,
              calories: 321,
            },
          },
        ]}
        disabled={false}
        onStatus={() => {}}
        onAdjust={() => {}}
      />,
    );

    expect(html).toContain("Tổng dinh dưỡng cả ngày");
    expect(html).toContain("321");
    expect(html).toContain("766");
    expect(html).toContain("Còn thiếu");
    expect(html).toContain("Điều chỉnh");
    expect(html).not.toContain("Đã đổi");
  });
});
