import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TdeeFormCard from "../cards/TdeeFormCard";
import TdeeResultCard from "../cards/TdeeResultCard";

describe("HT Assistant TDEE cards", () => {
  it("không chọn sẵn mức vận động và hỏi bằng chứng cả ngày", () => {
    const html = renderToStaticMarkup(<TdeeFormCard onSubmit={() => {}} />);

    expect({
      noGenderDefault:
        html.includes("Nam</button>") &&
        !html.includes('aria-pressed="true"'),
      noDefault: html.includes('value="" selected="">Chọn sau khi khai báo vận động</option>'),
      wholeDayEvidence:
        html.includes("Vận động ngoài buổi tập") &&
        html.includes("Số bước trung bình") &&
        html.includes("Thời lượng mỗi buổi") &&
        html.includes("Cường độ buổi tập"),
      disabledSubmit: /<button[^>]*disabled=""[^>]*>/.test(html),
    }).toEqual({ noGenderDefault: true, noDefault: true, wholeDayEvidence: true, disabledSubmit: true });
  });

  it("hiển thị khoảng ước tính và hướng dẫn hiệu chỉnh 14 ngày", () => {
    const html = renderToStaticMarkup(
      <TdeeResultCard
        data={{
          bmr: 1699,
          tdee: 2633,
          tdeeRange: { min: 2548, max: 2718 },
          targetCalories: 2333,
          targetCaloriesRange: { min: 2248, max: 2418 },
          goal: "Giảm mỡ",
          activityLevel: "Vận động vừa",
          activity: { multiplier: 1.55, range: [1.5, 1.6] },
          calibrationDays: 14,
          macros: null,
        }}
      />,
    );

    expect(html).toContain("2.548–2.718");
    expect(html).toContain("14 ngày");
    expect(html).toMatch(/ước tính/i);
  });

  it("giữ copy hiệu chỉnh macro tối thiểu 14 ngày ở cả hai locale", async () => {
    const [{ default: vi }, { default: en }] = await Promise.all([
      import("../../../i18n/locales/vi/tdee.json"),
      import("../../../i18n/locales/en/tdee.json"),
    ]);

    expect(vi.info.macro_note).toContain("ít nhất 14 ngày");
    expect(en.info.macro_note).toContain("at least 14 days");
  });
});
