import { describe, expect, it } from "vitest";

import {
  normalizeKnowledgeQuestion,
  parseKnowledgeEntryPayload,
} from "../knowledgeBase.js";

describe("knowledge base DTO validation", () => {
  it("normalizes equivalent questions deterministically", () => {
    expect(normalizeKnowledgeQuestion("  Protein   là GÌ? ")).toBe(
      "protein là gì?",
    );
  });

  it("rejects server-owned fields and excessive variants", () => {
    expect(
      parseKnowledgeEntryPayload({
        question: "Protein là gì?",
        answer: "Một chất dinh dưỡng.",
        embedding: [1, 2, 3],
      }).error,
    ).toContain("embedding");

    expect(
      parseKnowledgeEntryPayload({
        question: "Protein là gì?",
        answer: "Một chất dinh dưỡng.",
        variants: Array.from({ length: 21 }, (_, index) => `Variant ${index}`),
      }).error,
    ).toContain("20");
  });

  it("deduplicates tags and variants", () => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Protein là gì?",
      answer: "Một chất dinh dưỡng.",
      tags: ["Protein", " protein "],
      variants: ["Protein dùng làm gì?", " protein dùng làm gì? "],
    });

    expect(parsed.value.tags).toEqual(["Protein"]);
    expect(parsed.value.variants).toEqual(["Protein dùng làm gì?"]);
  });
});
