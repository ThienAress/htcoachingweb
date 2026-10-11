const DEGRADABLE_CODES = new Set(["DEEPSEEK_TIMEOUT", "KB_TRIAL_SELECTION_DEADLINE"]);

/**
 * True only for upstream latency/deadline failures of the KB selector.
 * Protocol, corpus, privacy and stale-entry failures stay fail-closed.
 */
export const isKnowledgeSelectionTimeout = (error) => {
  if (DEGRADABLE_CODES.has(error?.code)) return true;
  return error?.code === "KB_TRIAL_SELECTION_FAILED" && DEGRADABLE_CODES.has(error?.cause?.code);
};
