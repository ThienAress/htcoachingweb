import { describe, expect, it } from "vitest";

import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_DESCRIPTION_MIN_LENGTH,
  normalizeSeoDescription,
} from "../seoDescription.js";

const expectSnippetLength = (description) => {
  expect(description.length).toBeGreaterThanOrEqual(
    SEO_DESCRIPTION_MIN_LENGTH,
  );
  expect(description.length).toBeLessThanOrEqual(
    SEO_DESCRIPTION_MAX_LENGTH,
  );
};

describe("normalizeSeoDescription", () => {
  it("normalizes whitespace and keeps a Vietnamese snippet within the target", () => {
    const description = normalizeSeoDescription(
      "Công thức Vegan Banh Mi gồm 12 nguyên liệu và 6 bước thực hiện rõ ràng, kèm thông tin dinh dưỡng toàn món.\nXem cách chuẩn bị và nấu an toàn, chi tiết tại HTCOACHING.",
    );

    expect(description).not.toMatch(/\s{2,}/u);
    expectSnippetLength(description);
  });

  it("truncates a long English snippet at a word boundary", () => {
    const description = normalizeSeoDescription(
      "Learn exercise Cable Lat Pulldown Full Range Of Motion for Back with 3 clear steps. Review the setup, controlled execution, technique cues, common mistakes, and safety notes in the HTCOACHING exercise library.",
    );

    expect(description).toMatch(/mistakes,…$/u);
    expectSnippetLength(description);
  });
});
