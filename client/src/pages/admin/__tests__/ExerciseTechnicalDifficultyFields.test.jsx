import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ExerciseTechnicalDifficultyFields from "../ExerciseTechnicalDifficultyFields";

describe("ExerciseTechnicalDifficultyFields", () => {
  it("renders all five rubric criteria and keeps personal load outside the rating", () => {
    const html = renderToStaticMarkup(
      <ExerciseTechnicalDifficultyFields
        value={{}}
        onChange={() => {}}
      />,
    );

    expect({
      coordination: html.includes("Phối hợp kỹ thuật"),
      stability: html.includes("Thăng bằng / ổn định"),
      mobility: html.includes("Mobility / biên độ"),
      setup: html.includes("Setup / thiết bị"),
      consequence: html.includes("Hậu quả khi sai"),
      rationale: html.includes("Lý do đánh giá"),
      boundary: html.includes("không bao gồm sets, reps, mức tạ, RPE/RIR"),
    }).toEqual({
      coordination: true,
      stability: true,
      mobility: true,
      setup: true,
      consequence: true,
      rationale: true,
      boundary: true,
    });
  });
});
