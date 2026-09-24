import { describe, expect, it } from "vitest";

import {
  normalizeKnowledgeQuestion,
  parseKnowledgeEntryPayload,
  validateKnowledgePublication,
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

  it("accepts bounded HTTPS evidence metadata and keeps review fields server-owned", () => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Creatine có hiệu quả không?",
      answer: "Creatine có bằng chứng hỗ trợ sức mạnh trong một số bối cảnh tập luyện.",
      category: "supplement",
      evidenceLevel: "source_backed",
      freshnessClass: "periodic",
      reviewDueAt: "2027-01-15T00:00:00.000Z",
      sources: [
        {
          type: "research",
          title: "Synthetic position stand",
          publisher: "Synthetic Sports Society",
          url: "https://example.org/research/creatine",
          publishedAt: "2025-01-01T00:00:00.000Z",
          retrievedAt: "2026-09-12T00:00:00.000Z",
          evidenceTier: "primary",
        },
      ],
    });

    expect(parsed.error).toBeUndefined();
    expect(parsed.value).toMatchObject({
      evidenceLevel: "source_backed",
      freshnessClass: "periodic",
      sources: [
        {
          type: "research",
          evidenceTier: "primary",
          url: "https://example.org/research/creatine",
        },
      ],
    });

    expect(
      parseKnowledgeEntryPayload({
        question: "Server fields?",
        answer: "Không cho client tự duyệt.",
        reviewStatus: "reviewed",
      }).error,
    ).toContain("reviewStatus");
  });

  it("rejects non-HTTPS external evidence and unsupported source fields", () => {
    const insecure = parseKnowledgeEntryPayload({
      question: "Nguồn nào?",
      answer: "Nguồn thử nghiệm.",
      sources: [
        {
          type: "official",
          title: "Synthetic source",
          publisher: "Synthetic Publisher",
          url: "http://example.org/source",
          evidenceTier: "primary",
        },
      ],
    });
    const forged = parseKnowledgeEntryPayload({
      question: "Nguồn nào khác?",
      answer: "Nguồn thử nghiệm.",
      sources: [
        {
          type: "official",
          title: "Synthetic source",
          publisher: "Synthetic Publisher",
          url: "https://example.org/source",
          evidenceTier: "primary",
          rawConversation: "không được nhận",
        },
      ],
    });

    expect(insecure.error).toContain("HTTPS");
    expect(forged.error).toContain("rawConversation");
  });

  it.each([
    "access_token",
    "api_key",
    "key",
    "secret",
    "password",
    "signature",
    "X-Amz-Signature",
    "auth",
    "session",
    "JSESSIONID",
    "PHPSESSID",
    "auth_code",
  ])("rejects credential-like source URL query parameter %s", (parameter) => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Synthetic source question?",
      answer: "Synthetic source answer.",
      sources: [
        {
          type: "research",
          title: "Synthetic research source",
          publisher: "Synthetic Journal",
          url: `https://example.org/source?${parameter}=SYNTHETIC_SECRET_MARKER`,
          evidenceTier: "primary",
        },
      ],
    });

    expect(parsed.error).toContain("sources[0].url");
  });

  it("allows a benign HTTPS source URL query", () => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Synthetic source question?",
      answer: "Synthetic source answer.",
      sources: [
        {
          type: "research",
          title: "Synthetic research source",
          publisher: "Synthetic Journal",
          url: "https://example.org/source?section=methods&lang=vi&session_type=online",
          evidenceTier: "primary",
        },
      ],
    });

    expect(parsed.value?.sources[0].url).toBe(
      "https://example.org/source?section=methods&lang=vi&session_type=online",
    );
  });

  it.each([
    "https://example.org/share/auth/SYNTHETIC_SECRET_MARKER",
    "https://example.org/session/SYNTHETIC_SECRET_MARKER",
  ])("rejects a credential-labelled URL path carrying a value: %s", (url) => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Synthetic source question?",
      answer: "Synthetic source answer.",
      sources: [
        {
          type: "research",
          title: "Synthetic research source",
          publisher: "Synthetic Journal",
          url,
          evidenceTier: "primary",
        },
      ],
    });

    expect(parsed.error).toContain("sources[0].url");
  });

  it("rejects a session credential stored as a URL path parameter", () => {
    const parsed = parseKnowledgeEntryPayload({
      question: "Synthetic source question?",
      answer: "Synthetic source answer.",
      sources: [{
        type: "research",
        title: "Synthetic research source",
        publisher: "Synthetic Journal",
        url: "https://example.org/source;jsessionid=SYNTHETIC_SECRET_MARKER",
        evidenceTier: "primary",
      }],
    });

    expect(parsed.error).toContain("sources[0].url");
  });

  it("enforces the approved evidence policy before publication", () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const sourceBacked = {
      category: "health",
      evidenceLevel: "source_backed",
      freshnessClass: "time_sensitive",
      reviewDueAt: new Date("2026-10-12T00:00:00.000Z"),
      sources: [
        {
          type: "research",
          title: "Synthetic health source",
          publisher: "Synthetic Journal",
          url: "https://example.org/health/source",
          evidenceTier: "primary",
        },
      ],
    };

    expect(validateKnowledgePublication(sourceBacked, { now })).toEqual({ valid: true });
    expect(
      validateKnowledgePublication(
        { ...sourceBacked, evidenceLevel: "legacy_unverified" },
        { now },
      ),
    ).toMatchObject({ valid: false });
    expect(
      validateKnowledgePublication(
        { ...sourceBacked, reviewDueAt: new Date("2026-09-11T00:00:00.000Z") },
        { now },
      ),
    ).toMatchObject({ valid: false });
    expect(
      validateKnowledgePublication(
        {
          ...sourceBacked,
          freshnessClass: "stable",
          reviewDueAt: new Date("2026-09-11T00:00:00.000Z"),
        },
        { now },
      ),
    ).toMatchObject({
      valid: false,
      code: "KNOWLEDGE_REVIEW_DUE_REQUIRED",
    });
    expect(
      validateKnowledgePublication(
        {
          ...sourceBacked,
          freshnessClass: "stable",
          reviewDueAt: null,
        },
        { now },
      ),
    ).toEqual({ valid: true });
    expect(
      validateKnowledgePublication(
        {
          category: "athlete",
          evidenceLevel: "canonical_internal",
          freshnessClass: "stable",
          sources: [
            {
              type: "internal",
              title: "Synthetic internal source",
              publisher: "HTCOACHING",
              evidenceTier: "canonical",
            },
          ],
        },
        { now },
      ),
    ).toMatchObject({ valid: false });
  });

  it.each(["service", "hlv", "platform"])(
    "publishes the %s category only with canonical internal evidence",
    (category) => {
      const canonicalSource = {
        type: "internal",
        title: "Synthetic HTCOACHING canonical record",
        publisher: "HTCOACHING",
        evidenceTier: "canonical",
      };
      const externalSource = {
        type: "official",
        title: "Synthetic external source",
        publisher: "Synthetic Publisher",
        url: "https://example.org/external/source",
        evidenceTier: "primary",
      };

      expect({
        canonical: validateKnowledgePublication({
          category,
          evidenceLevel: "canonical_internal",
          freshnessClass: "stable",
          sources: [canonicalSource],
        }),
        sourceBacked: validateKnowledgePublication({
          category,
          evidenceLevel: "source_backed",
          freshnessClass: "stable",
          sources: [externalSource],
        }),
      }).toEqual({
        canonical: { valid: true },
        sourceBacked: {
          valid: false,
          code: "KNOWLEDGE_CANONICAL_INTERNAL_REQUIRED",
          message: expect.any(String),
        },
      });
    },
  );

  it("requires evidence tiers that match the selected publication level", () => {
    const externalSource = {
      type: "research",
      title: "Synthetic research source",
      publisher: "Synthetic Journal",
      url: "https://example.org/research/tier-policy",
    };

    expect(
      validateKnowledgePublication({
        category: "health",
        evidenceLevel: "source_backed",
        freshnessClass: "stable",
        sources: [{ ...externalSource, evidenceTier: "conversation" }],
      }),
    ).toMatchObject({
      valid: false,
      code: "KNOWLEDGE_EXTERNAL_SOURCE_REQUIRED",
    });
    expect(
      validateKnowledgePublication({
        category: "training",
        evidenceLevel: "editor_reviewed",
        freshnessClass: "stable",
        sources: [
          {
            ...externalSource,
            type: "professional",
            evidenceTier: "legacy_unknown",
          },
        ],
      }),
    ).toMatchObject({
      valid: false,
      code: "KNOWLEDGE_EDITOR_REVIEW_INVALID",
    });
    expect(
      validateKnowledgePublication({
        category: "training",
        evidenceLevel: "editor_reviewed",
        freshnessClass: "stable",
        sources: [
          {
            ...externalSource,
            type: "professional",
            evidenceTier: "professional",
          },
        ],
      }),
    ).toEqual({ valid: true });
  });

  it("rejects a ready embedding from a stale profile before publication", () => {
    expect(
      validateKnowledgePublication({
        category: "health",
        embeddingStatus: "ready",
        embeddingVersion: "stale-embedding-profile-v1",
        evidenceLevel: "source_backed",
        freshnessClass: "stable",
        sources: [
          {
            type: "research",
            title: "Synthetic profile guard source",
            publisher: "Synthetic Journal",
            url: "https://example.org/research/profile-guard",
            evidenceTier: "primary",
          },
        ],
      }),
    ).toMatchObject({
      valid: false,
      code: "KNOWLEDGE_EMBEDDING_VERSION_MISMATCH",
    });
  });
});
