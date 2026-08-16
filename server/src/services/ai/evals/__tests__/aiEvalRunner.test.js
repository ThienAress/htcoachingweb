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
});
