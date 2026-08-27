import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QuickMealHistory } from "../QuickMealHistory";
import { QuickMealLogger } from "../QuickMealLogger";

describe("quick meal presentation", () => {
  it("starts with one Vietnamese add action and no recipe/manual mode switch", () => {
    const html = renderToStaticMarkup(
      <QuickMealLogger entryCount={0} disabled={false} onAdd={() => {}} />,
    );

    expect(html).toContain("Ghi bữa ăn phát sinh");
    expect(html).toContain("Thêm bữa ăn");
    expect(html).not.toContain("Công thức");
    expect(html).not.toContain("Mô tả thủ công");
  });

  it("shows Update only before the manual entry uses its single update", () => {
    const html = renderToStaticMarkup(
      <QuickMealHistory
        entries={[
          {
            entryId: "new",
            mode: "manual",
            mealName: "Bữa phụ",
            description: "Một quả chuối",
            editCount: 0,
          },
          {
            entryId: "updated",
            mode: "manual",
            mealName: "Sau buổi tập",
            description: "Sữa chua",
            editCount: 1,
          },
        ]}
        disabled={false}
        onUpdate={() => {}}
      />,
    );

    expect(html).toContain("Bữa phụ");
    expect(html).toContain("Sau buổi tập");
    expect((html.match(/> Cập nhật</g) || [])).toHaveLength(1);
    expect(html).not.toContain("Xóa");
  });
});
