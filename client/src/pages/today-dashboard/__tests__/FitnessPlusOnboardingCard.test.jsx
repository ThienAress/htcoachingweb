import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import FitnessPlusOnboardingCard from "../FitnessPlusOnboardingCard";

describe("FitnessPlusOnboardingCard", () => {
  it("hiện tiêu đề, quyền lợi và liên kết tới bảng giá HT Fitness+", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FitnessPlusOnboardingCard />
      </MemoryRouter>,
    );

    expect(html).toContain("Bắt đầu hành trình tập luyện của bạn");
    expect(html).toContain("Đánh giá bản thân");
    expect(html).toContain("Dinh dưỡng");
    expect(html).toContain("Nhật ký");
    expect(html).toContain("Tiến trình");
    expect(html).toContain('href="/?plan=fitness-plus#pricing"');
  });
});
