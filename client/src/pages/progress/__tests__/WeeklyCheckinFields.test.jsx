import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeklyCheckinFields } from "../WeeklyCheckinFields";

describe("WeeklyCheckinFields", () => {
  it("renders only the four body measurements requested by the weekly report", () => {
    const html = renderToStaticMarkup(
      <WeeklyCheckinFields
        register={(name) => ({ name })}
        errors={{}}
        disabled={false}
      />,
    );

    expect(html).toContain("Cân nặng (kg)");
    expect(html).toContain("Vòng eo (cm)");
    expect(html).toContain("Tỷ lệ mỡ cơ thể (%)");
    expect(html).toContain("Tỷ lệ cơ xương (%)");
    expect(html).not.toMatch(
      /Năng lượng|Mức độ bám kế hoạch|Điều làm tốt|Khó khăn gặp phải|Ghi chú thêm|Mức hiện tại/,
    );
  });
});
