import { describe, expect, it } from "vitest";

import { EMBEDDING_VERSION } from "../embeddingProfile.js";
import { rankKnowledgeCandidates } from "../retrievalRuntime.js";

const candidate = (overrides = {}) => ({
  _id: "kb-safe",
  question: "How should adults progress resistance training?",
  answer: "Use gradual progression and recovery.",
  sources: [],
  similarity: 0.9,
  matchSource: "primary",
  category: "training",
  status: "published",
  embeddingStatus: "ready",
  embeddingVersion: EMBEDDING_VERSION,
  reviewStatus: "reviewed",
  evidenceLevel: "source_backed",
  ...overrides,
});

describe("Knowledge retrieval privacy boundary", () => {
  it("excludes previously published private records before returning evidence IDs", () => {
    const results = rankKnowledgeCandidates([
      candidate({
        _id: "kb-private",
        answer: "Client zoraqx quux has lupus and needs a private plan.",
        sources: [{
          title: "jane has lupus",
          publisher: "Synthetic Journal",
          url: "https://example.org/patients/john-smith-hiv-report",
        }],
        similarity: 0.98,
      }),
      candidate(),
    ], { embeddingVersion: EMBEDDING_VERSION });

    expect(results.map(({ _id }) => _id)).toEqual(["kb-safe"]);
  });

  it("excludes imported source URLs with authentication parameters", () => {
    const results = rankKnowledgeCandidates([candidate({
      sources: [{
        title: "General resistance training",
        publisher: "Synthetic Journal",
        url: "https://example.org/source?auth=SYNTHETIC_SECRET_MARKER",
      }],
    })], { embeddingVersion: EMBEDDING_VERSION });

    expect(results).toEqual([]);
  });

  it.each([
    [
      "a private diagnosis in the matched variant",
      { matchedQuestion: "zoraqx quux was diagnosed with lupus" },
    ],
    [
      "a private record URL without a conventional suffix",
      { sources: [{
        title: "General resistance training",
        publisher: "Synthetic Journal",
        url: "https://example.org/private/zoraqx-quux-notes",
      }] },
    ],
    [
      "a legacy session-cookie URL",
      { sources: [{
        title: "General resistance training",
        publisher: "Synthetic Journal",
        url: "https://example.org/source?JSESSIONID=SYNTHETIC_SECRET_MARKER",
      }] },
    ],
    [
      "a legacy session-cookie path parameter",
      { sources: [{
        title: "General resistance training",
        publisher: "Synthetic Journal",
        url: "https://example.org/source;jsessionid=SYNTHETIC_SECRET_MARKER",
      }] },
    ],
  ])("excludes imported evidence containing %s", (_label, override) => {
    expect(rankKnowledgeCandidates([candidate(override)], {
      embeddingVersion: EMBEDDING_VERSION,
    })).toEqual([]);
  });
});
