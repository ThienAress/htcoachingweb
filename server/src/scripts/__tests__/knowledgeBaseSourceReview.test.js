import { describe, expect, test } from "vitest";

import { buildSourceReviewPacket } from "../knowledgeBaseSourceReview.js";

describe("production knowledge source review", () => {
  test("keeps only entry content and source metadata", () => {
    const packet = buildSourceReviewPacket([
      {
        _id: "507f1f77bcf86cd799439011",
        question: "  Câu hỏi  ",
        answer: "Câu trả lời",
        category: "nutrition",
        status: "published",
        sources: [
          {
            _id: "subdocument-id",
            type: "official",
            title: "Official guidance",
            publisher: "Publisher",
            url: "https://example.com/guidance",
            evidenceTier: "primary",
          },
        ],
        evidenceLevel: "source_backed",
        reviewStatus: "reviewed",
        freshnessClass: "stable",
        reviewDueAt: null,
        updatedAt: new Date("2026-09-29T00:00:00.000Z"),
        createdBy: "sensitive-user-id",
        source: { conversationId: "sensitive-conversation-id" },
      },
    ], { generatedAt: new Date("2026-09-29T00:00:00.000Z") });

    expect(packet.version).toBe(1);
    expect(packet.documents).toHaveLength(1);
    expect(packet.documents[0]).toEqual({
      sourceId: "507f1f77bcf86cd799439011",
      question: "  Câu hỏi  ",
      answer: "Câu trả lời",
      category: "nutrition",
      status: "published",
      existingSources: [{
        type: "official",
        title: "Official guidance",
        publisher: "Publisher",
        url: "https://example.com/guidance",
        publishedAt: null,
        retrievedAt: null,
        evidenceTier: "primary",
      }],
      evidenceLevel: "source_backed",
      reviewStatus: "reviewed",
      freshnessClass: "stable",
      reviewDueAt: null,
      updatedAt: "2026-09-29T00:00:00.000Z",
    });
    expect(JSON.stringify(packet)).not.toMatch(/createdBy|conversationId/);
  });
});
