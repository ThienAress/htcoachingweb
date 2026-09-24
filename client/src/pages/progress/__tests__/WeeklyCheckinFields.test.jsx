import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeklyCheckinFields } from "../WeeklyCheckinFields";

describe("WeeklyCheckinFields", () => {
  it("renders grouped optional body measurements and their current summary", () => {
    const html = renderToStaticMarkup(
      <WeeklyCheckinFields
        register={(name) => ({ name })}
        errors={{}}
        disabled={false}
        values={{ waistCm: "80", hipCm: "100", abdomenCm: "" }}
      />,
    );

    expect(html).toContain("Cân nặng (kg)");
    expect(html).toContain("Vòng eo (cm)");
    expect(html).toContain("Vòng hông (cm)");
    expect(html).toContain("Vòng bụng (cm)");
    expect(html).toContain("Số đo vòng");
    expect(html).toContain("Thành phần cơ thể");
    expect(html).toContain("0,8");
    expect(html).toContain("Đã nhập 2/3");
    expect(html).toContain("Tỷ lệ mỡ cơ thể (%)");
    expect(html).toContain("Tỷ lệ cơ xương (%)");
    expect(html).not.toMatch(
      /Năng lượng|Mức độ bám kế hoạch|Điều làm tốt|Khó khăn gặp phải|Ghi chú thêm|Mức hiện tại/,
    );
  });

  it("exposes field-level errors and opens the invalid group", () => {
    const html = renderToStaticMarkup(<WeeklyCheckinFields
      register={(name) => ({ name })} errors={{ hipCm: { message: "Ngoài giới hạn" } }} disabled={false}
    />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Ngoài giới hạn");
    expect(html).toContain('aria-expanded="true"');
  });
});
