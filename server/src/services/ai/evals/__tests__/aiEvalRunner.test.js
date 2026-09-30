import { describe, expect, it } from "vitest";

import {
  evaluateAiCorpus,
  validateAiEvalCorpus,
} from "../aiEvalRunner.js";

const validCorpus = {
  schemaVersion: 1,
  corpusVersion: "test-v1",
  scenarios: [
    {
      id: "system-contract",
      evaluator: "system_prompt_contract",
      input: {},
      expected: {
        contains: ["HT Assistant", "KHÔNG kê đơn thuốc"],
        excludes: ["GEMINI_API_KEY"],
        maxCharacters: 30000,
      },
    },
  ],
};

const EVAL_EMBEDDING_VERSION = "eval-question-answering-v1";
const currentCandidate = (entryId, similarity, overrides = {}) => ({
  entryId,
  similarity,
  matchSource: "primary",
  status: "published",
  embeddingStatus: "ready",
  embeddingVersion: EVAL_EMBEDDING_VERSION,
  evidenceLevel: "source_backed",
  reviewStatus: "reviewed",
  reviewDueAt: "2027-01-01T00:00:00.000Z",
  ...overrides,
});

const retrievalQualityScenario = {
  id: "retrieval-golden-quality",
  evaluator: "retrieval_quality_contract",
  input: {
    runtime: {
      embeddingVersion: EVAL_EMBEDDING_VERSION,
      now: "2026-09-12T00:00:00.000Z",
      limit: 3,
      threshold: 0.75,
    },
    queries: [
      {
        id: "primary-hit",
        golden: { entryId: "kb-squat" },
        candidates: [
          currentCandidate("kb-lunge", 0.82),
          currentCandidate("kb-squat", 0.96),
        ],
      },
      {
        id: "variant-hit",
        golden: { entryId: "kb-creatine", matchSource: "variant" },
        candidates: [
          currentCandidate("kb-creatine", 0.78),
          currentCandidate("kb-protein", 0.9),
          currentCandidate("kb-creatine", 0.97, { matchSource: "variant" }),
        ],
      },
      {
        id: "no-hit",
        golden: { noHit: true },
        candidates: [currentCandidate("kb-height-claim", 0.74)],
      },
      {
        id: "stale-excluded",
        golden: {
          entryId: "kb-protein-current",
          excluded: { stale: ["kb-protein-stale"] },
        },
        candidates: [
          currentCandidate("kb-protein-stale", 0.99, {
            reviewStatus: "stale",
          }),
          currentCandidate("kb-protein-current", 0.9),
        ],
      },
      {
        id: "legacy-excluded",
        golden: {
          entryId: "kb-deadlift-v2",
          excluded: { legacy: ["kb-deadlift-v1"] },
        },
        candidates: [
          currentCandidate("kb-deadlift-v1", 0.99, {
            evidenceLevel: "legacy_unverified",
            reviewStatus: "needs_review",
          }),
          currentCandidate("kb-deadlift-v2", 0.9),
        ],
      },
      {
        id: "top-three-hit",
        golden: { entryId: "kb-progressive-overload" },
        candidates: [
          currentCandidate("kb-progressive-overload", 0.85),
          currentCandidate("kb-training-volume", 0.95),
          currentCandidate("kb-deload", 0.9),
        ],
      },
    ],
  },
  expected: {
    minimumMetrics: {
      top1Accuracy: 0.8,
      top3Recall: 1,
      noHitAccuracy: 1,
      variantCoverage: 1,
      staleExclusionRate: 1,
      legacyExclusionRate: 1,
    },
  },
};

describe("AI eval corpus contract", () => {
  it("rejects duplicate scenario IDs and unknown evaluators", () => {
    const invalid = {
      ...validCorpus,
      scenarios: [
        validCorpus.scenarios[0],
        { ...validCorpus.scenarios[0], evaluator: "unknown_evaluator" },
      ],
    };

    expect(() => validateAiEvalCorpus(invalid)).toThrow(
      /duplicate scenario id|unknown evaluator/i,
    );
  });

  it("fails closed when expected assertions are missing", () => {
    const invalid = {
      ...validCorpus,
      scenarios: [{ ...validCorpus.scenarios[0], expected: {} }],
    };

    expect(() => validateAiEvalCorpus(invalid)).toThrow(/expected contract/i);
  });

  it("runs deterministic scenarios without a provider or secret", async () => {
    const report = await evaluateAiCorpus(validCorpus);

    expect(report).toMatchObject({
      corpusVersion: "test-v1",
      passed: 1,
      failed: 0,
      total: 1,
    });
    expect(report.results[0]).toMatchObject({
      id: "system-contract",
      passed: true,
    });
  });

  it("evaluates request routing without calling a provider", async () => {
    const corpus = {
      schemaVersion: 1,
      corpusVersion: "router-test-v1",
      scenarios: [
        {
          id: "ronaldo-needs-web-evidence",
          evaluator: "request_router_contract",
          input: {
            message: "Ronaldo thường tập những bài gì?",
            canUseWebSearch: false,
          },
          expected: {
            pathEquals: {
              domain: "fitness",
              evidence: "web_required",
              knowledgeBaseEligible: false,
              maxWebSearchCalls: 1,
            },
            routingText: {
              contains: ["không được dùng trí nhớ model để khẳng định"],
              maxCharacters: 1600,
            },
          },
        },
      ],
    };

    const report = await evaluateAiCorpus(corpus);

    expect(report).toMatchObject({ passed: 1, failed: 0, total: 1 });
  });

  it("labels semantic oracle fixtures separately from runtime captures", async () => {
    const report = await evaluateAiCorpus({
      schemaVersion: 1,
      corpusVersion: "semantic-test-v1",
      scenarios: [{
        id: "meal-output-is-server-consistent",
        evaluator: "semantic_output_contract",
        evidenceKind: "oracle_fixture",
        input: {
          output: {
            cards: [{
              cardType: "meal",
              data: {
                status: "complete",
                totals: { protein: 30, carb: 50, fat: 20, calories: 500 },
                meals: [{
                  totals: { protein: 30, carb: 50, fat: 20, calories: 500 },
                  foods: [{
                    foodId: "breakfast-complete",
                    name: "Bữa sáng mẫu",
                    macros: { protein: 30, carb: 50, fat: 20 },
                    calories: 500,
                  }],
                }],
              },
            }],
          },
        },
        expected: {
          rules: [{
            type: "meal_numeric",
            targetCalories: 500,
            toleranceCalories: 25,
            minimumProteinGrams: 30,
          }],
        },
      }],
    });

    expect(report).toMatchObject({
      passed: 1,
      failed: 0,
      total: 1,
      semanticEvidence: { oracleFixtures: 1, runtimeCaptures: 0 },
      results: [{ evidenceKind: "oracle_fixture" }],
    });
  });

  it("rejects an unlabeled semantic fixture so it cannot be reported as live UX evidence", () => {
    expect(() => validateAiEvalCorpus({
      schemaVersion: 1,
      corpusVersion: "semantic-test-v1",
      scenarios: [{
        id: "unlabeled-semantic-output",
        evaluator: "semantic_output_contract",
        input: { output: { text: "synthetic" } },
        expected: { rules: [{ type: "seven_day_coverage" }] },
      }],
    })).toThrowError(/evidenceKind/);
  });

  it("reports deterministic retrieval quality metrics for every required dimension", async () => {
    const report = await evaluateAiCorpus({
      schemaVersion: 1,
      corpusVersion: "retrieval-test-v1",
      scenarios: [retrievalQualityScenario],
    });

    expect(report.results[0]).toMatchObject({
      passed: true,
      metrics: {
        top1Accuracy: 0.8,
        top3Recall: 1,
        noHitAccuracy: 1,
        variantCoverage: 1,
        staleExclusionRate: 1,
        legacyExclusionRate: 1,
        counts: {
          answerable: 5,
          noHit: 1,
          variant: 1,
          staleChecks: 1,
          legacyChecks: 1,
        },
      },
    });
  });

  it("rejects a golden stale exclusion that is actually current", async () => {
    const degradedScenario = structuredClone(retrievalQualityScenario);
    const staleCandidate = degradedScenario.input.queries[3].candidates.find(
      ({ entryId }) => entryId === "kb-protein-stale",
    );
    staleCandidate.reviewStatus = "reviewed";

    const report = await evaluateAiCorpus({
      schemaVersion: 1,
      corpusVersion: "retrieval-degraded-v1",
      scenarios: [degradedScenario],
    });

    expect(report.results[0]).toMatchObject({
      passed: false,
      failures: expect.arrayContaining([
        expect.stringMatching(/stale exclusion is not a stale candidate/i),
      ]),
    });
  });

  it("rejects precomputed results and missing deterministic runtime settings", async () => {
    const precomputed = structuredClone(retrievalQualityScenario);
    precomputed.input.queries[0].results = [];
    delete precomputed.input.queries[0].candidates;
    const missingVersion = structuredClone(retrievalQualityScenario);
    delete missingVersion.input.runtime.embeddingVersion;

    const precomputedReport = await evaluateAiCorpus({
        schemaVersion: 1,
        corpusVersion: "retrieval-precomputed-v1",
        scenarios: [precomputed],
      });
    const missingVersionReport = await evaluateAiCorpus({
        schemaVersion: 1,
        corpusVersion: "retrieval-missing-runtime-v1",
        scenarios: [missingVersion],
      });

    expect(precomputedReport.results[0]).toMatchObject({
      passed: false,
      failures: [expect.stringMatching(/candidates/i)],
    });
    expect(missingVersionReport.results[0]).toMatchObject({
      passed: false,
      failures: [expect.stringMatching(/embeddingVersion/i)],
    });
  });
});
