import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, values) =>
      ({
        "difficulty.not_rated": "Chưa đánh giá",
        "difficulty.rating_label": `${values?.rating} trên 5 sao về độ phức tạp kỹ thuật`,
        "difficulty.tooltip":
          "Đánh giá kỹ thuật, không phản ánh mức tạ hoặc cường độ cá nhân.",
      })[key] || key,
  }),
}));

import TechnicalDifficultyRating from "../TechnicalDifficultyRating";

describe("TechnicalDifficultyRating", () => {
  it("renders legacy exercises as unrated", () => {
    const html = renderToStaticMarkup(
      <TechnicalDifficultyRating rating={null} />,
    );

    expect(html).toContain("Chưa đánh giá");
  });

  it("renders an accessible three-out-of-five technical rating", () => {
    const html = renderToStaticMarkup(
      <TechnicalDifficultyRating rating={3} />,
    );

    expect({
      label: html.includes("3 trên 5 sao về độ phức tạp kỹ thuật"),
      activeStars: (html.match(/data-active="true"/g) || []).length,
      value: html.includes("3/5"),
      scope: html.includes("không phản ánh mức tạ hoặc cường độ cá nhân"),
    }).toEqual({ label: true, activeStars: 3, value: true, scope: true });
  });
});
