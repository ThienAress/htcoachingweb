import { describe, expect, it } from "vitest";

import {
  getAiPageContext,
  getAiPageSuggestions,
} from "../aiPageContext.js";

describe("AI page context presentation registry", () => {
  it("recognizes detail routes and returns page-specific suggestions", () => {
    const page = getAiPageContext("/blog/protein-cho-nguoi-tap");
    const suggestions = getAiPageSuggestions("/blog/protein-cho-nguoi-tap");

    expect(page).toMatchObject({ pageType: "blog", isDetail: true });
    expect(suggestions[0].value).toContain("Tóm tắt");
  });

  it("covers customer-facing tools beyond blog and recipe", () => {
    expect(getAiPageContext("/tdee-calculator").pageType).toBe(
      "tdee_calculator",
    );
    expect(getAiPageContext("/club").pageType).toBe("club");
    expect(getAiPageContext("/book-training").pageType).toBe("booking");
  });

  it("falls back safely for an unknown route", () => {
    expect(getAiPageContext("/unknown")).toMatchObject({
      pageType: "general",
      proactive: null,
    });
  });
});
