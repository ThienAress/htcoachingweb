import { describe, expect, it } from "vitest";
import { isKnowledgeSelectionTimeout } from "../knowledgeSelectionFailure.js";
import {
  CHAT_KNOWLEDGE_SELECTION_TIMEOUT_MS,
  KNOWLEDGE_SELECTION_TIMEOUT_MS,
} from "../knowledgeSelectionPolicy.js";

const coded = (code, cause) => Object.assign(new Error(code), { code, ...(cause && { cause }) });

describe("knowledge selection failure classification", () => {
  it("degrades only upstream timeout and deadline failures", () => {
    expect(isKnowledgeSelectionTimeout(coded("DEEPSEEK_TIMEOUT"))).toBe(true);
    expect(isKnowledgeSelectionTimeout(coded("KB_TRIAL_SELECTION_DEADLINE"))).toBe(true);
    expect(isKnowledgeSelectionTimeout(
      coded("KB_TRIAL_SELECTION_FAILED", coded("DEEPSEEK_TIMEOUT")),
    )).toBe(true);
  });

  it("keeps protocol, corpus, stale and unknown failures fail-closed", () => {
    for (const code of [
      "KB_TRIAL_SELECTION_PROTOCOL",
      "KB_TRIAL_SELECTION_INVALID",
      "KB_TRIAL_SELECTION_STALE",
      "KB_TRIAL_CORPUS_LIMIT",
      "DEEPSEEK_RATE_LIMITED",
    ]) {
      expect(isKnowledgeSelectionTimeout(coded(code))).toBe(false);
    }
    expect(isKnowledgeSelectionTimeout(coded("KB_TRIAL_SELECTION_FAILED", coded("OTHER")))).toBe(false);
    expect(isKnowledgeSelectionTimeout(null)).toBe(false);
  });

  it("keeps the chat budget below the shared selection cap", () => {
    expect(CHAT_KNOWLEDGE_SELECTION_TIMEOUT_MS).toBeLessThan(KNOWLEDGE_SELECTION_TIMEOUT_MS);
  });
});
