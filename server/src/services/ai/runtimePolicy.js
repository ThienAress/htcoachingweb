export const AI_RUNTIME_POLICY = Object.freeze({
  maxAgentIterations: 5,
  maxHistoryMessages: 20,
  maxToolCallsPerIteration: 4,
  maxToolCallsPerRequest: 8,
  chatDeadlineMs: 75_000,
  toolTimeoutMs: 15_000,
});

export const boundAiToolCalls = (calls, completedCount = 0) => {
  const available = Math.max(
    AI_RUNTIME_POLICY.maxToolCallsPerRequest - Number(completedCount || 0),
    0,
  );
  return (Array.isArray(calls) ? calls : []).slice(
    0,
    Math.min(AI_RUNTIME_POLICY.maxToolCallsPerIteration, available),
  );
};
