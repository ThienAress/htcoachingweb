const relevantEvaluations = (evaluations) =>
  evaluations.filter((evaluation) => evaluation.relevantIds.length > 0);

const assertEvaluations = (evaluations) => {
  if (!Array.isArray(evaluations)) {
    throw new TypeError("evaluations must be an array");
  }

  for (const evaluation of evaluations) {
    if (
      !Array.isArray(evaluation?.relevantIds)
      || !Array.isArray(evaluation?.resultIds)
    ) {
      throw new TypeError("each evaluation must provide relevantIds and resultIds arrays");
    }
  }
};

export const recallAtK = (evaluations, k = 5) => {
  assertEvaluations(evaluations);
  if (!Number.isInteger(k) || k < 1) {
    throw new RangeError("k must be a positive integer");
  }

  const judged = relevantEvaluations(evaluations);
  if (judged.length === 0) return 0;

  const total = judged.reduce((sum, evaluation) => {
    const relevantIds = new Set(evaluation.relevantIds);
    const retrievedIds = new Set(evaluation.resultIds.slice(0, k));
    const relevantRetrieved = [...relevantIds]
      .filter((id) => retrievedIds.has(id)).length;
    return sum + relevantRetrieved / relevantIds.size;
  }, 0);

  return total / judged.length;
};

export const retrievedPrecisionAtK = (evaluations, k = 5) => {
  assertEvaluations(evaluations);
  if (!Number.isInteger(k) || k < 1) {
    throw new RangeError("k must be a positive integer");
  }

  const judged = relevantEvaluations(evaluations);
  if (judged.length === 0) return 0;

  const total = judged.reduce((sum, evaluation) => {
    const relevantIds = new Set(evaluation.relevantIds);
    const retrievedIds = new Set(evaluation.resultIds.slice(0, k));
    if (retrievedIds.size === 0) return sum;
    const relevantRetrieved = [...retrievedIds]
      .filter((id) => relevantIds.has(id)).length;
    return sum + relevantRetrieved / retrievedIds.size;
  }, 0);

  return total / judged.length;
};

export const meanReciprocalRank = (evaluations) => {
  assertEvaluations(evaluations);
  const judged = relevantEvaluations(evaluations);
  if (judged.length === 0) return 0;

  const total = judged.reduce((sum, evaluation) => {
    const relevantIds = new Set(evaluation.relevantIds);
    const firstRelevantIndex = evaluation.resultIds
      .findIndex((id) => relevantIds.has(id));
    return sum + (firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1));
  }, 0);

  return total / judged.length;
};

export const noResultRate = (evaluations) => {
  assertEvaluations(evaluations);
  if (evaluations.length === 0) return 0;

  const noResultCount = evaluations
    .filter((evaluation) => evaluation.resultIds.length === 0).length;
  return noResultCount / evaluations.length;
};

const percentile = (sortedValues, percentileValue) => {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
  );
  return sortedValues[index];
};

export const summarizeLatency = (durationValues) => {
  if (!Array.isArray(durationValues)) {
    throw new TypeError("durationValues must be an array");
  }
  if (durationValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("latency durations must be finite non-negative numbers");
  }

  const sortedValues = [...durationValues].sort((left, right) => left - right);
  const totalMs = sortedValues.reduce((sum, value) => sum + value, 0);

  return {
    sampleCount: sortedValues.length,
    averageMs: sortedValues.length === 0 ? 0 : totalMs / sortedValues.length,
    p50Ms: percentile(sortedValues, 50),
    p95Ms: percentile(sortedValues, 95),
    maxMs: sortedValues.at(-1) ?? 0,
  };
};
