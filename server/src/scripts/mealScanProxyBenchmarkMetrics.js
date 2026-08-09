const HIDDEN_INGREDIENT_QUESTION_PATTERN =
  /\b(dau|mo|sot|nuoc cham|tuong|mam|sa te|sate|duong|bo|kem|nhan|khau phan|oil|fat|sauce|dressing|dip|sugar|butter|cream|filling|serving)\b/i;

const round = (value, decimals = 4) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const mean = (values) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const includesAlias = (source, aliases) => {
  const normalizedSource = ` ${normalizeText(source)} `;
  return (aliases || []).some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalizedAlias && normalizedSource.includes(` ${normalizedAlias} `);
  });
};

export const scoreProxyCase = (result, reference) => {
  const predictedLabels = (result.items || [])
    .map((item) => item.label)
    .filter(Boolean)
    .join(" | ");
  const ingredientGroups = reference.ingredientGroups || [];
  const ingredientHits = ingredientGroups.filter((group) =>
    includesAlias(predictedLabels, group.aliases),
  ).length;
  const questions = normalizeText((result.questions || []).join(" "));
  const predictedScenario = result.imageAssessment?.scenario || "unknown";
  const expectedScenario = reference.expectedScenario || null;

  return {
    confidence: result.confidence || "low",
    predictedScenario,
    scenarioMatched: expectedScenario
      ? predictedScenario === expectedScenario
      : null,
    dishMatched: includesAlias(result.mealName, reference.mealAliases),
    ingredientHits,
    ingredientTotal: ingredientGroups.length,
    ingredientRecall:
      ingredientGroups.length > 0
        ? round(ingredientHits / ingredientGroups.length)
        : null,
    hiddenIngredientQuestion:
      HIDDEN_INGREDIENT_QUESTION_PATTERN.test(questions),
  };
};

export const summarizeProxyBenchmark = (cases) => {
  const successfulCases = cases.filter((entry) => entry.success && entry.score);
  const scores = successfulCases.map((entry) => entry.score);
  const failures = cases.filter((entry) => !entry.success);
  const scenarioScores = scores.filter(
    (score) => typeof score.scenarioMatched === "boolean",
  );

  return {
    attempted: cases.length,
    successful: successfulCases.length,
    failed: failures.length,
    providerSuccessRate: round(
      cases.length > 0 ? successfulCases.length / cases.length : 0,
    ),
    mealNameAccuracy: round(
      mean(scores.map((score) => Number(score.dishMatched))),
    ),
    scenarioAccuracy: round(
      mean(
        scenarioScores.map((score) => Number(score.scenarioMatched)),
      ),
    ),
    meanIngredientRecall: round(
      mean(
        scores
          .map((score) => score.ingredientRecall)
          .filter(Number.isFinite),
      ),
    ),
    hiddenIngredientQuestionRate: round(
      mean(scores.map((score) => Number(score.hiddenIngredientQuestion))),
    ),
    confidenceCounts: Object.fromEntries(
      ["high", "medium", "low"].map((confidence) => [
        confidence,
        scores.filter((score) => score.confidence === confidence).length,
      ]),
    ),
    failuresByCode: Object.fromEntries(
      [...new Set(failures.map((entry) => entry.errorCode || "UNKNOWN"))]
        .sort()
        .map((code) => [
          code,
          failures.filter(
            (entry) => (entry.errorCode || "UNKNOWN") === code,
          ).length,
        ]),
    ),
  };
};

const PROXY_THRESHOLDS = {
  minimumSuccessfulSamples: 8,
  minimumProviderSuccessRate: 0.875,
  minimumMealNameAccuracy: 0.75,
  minimumIngredientRecall: 0.5,
};

export const evaluateProxyChecks = (summary) => {
  const checks = {
    minimumSuccessfulSamples:
      (summary.successful || 0) >= PROXY_THRESHOLDS.minimumSuccessfulSamples,
    minimumProviderSuccessRate:
      summary.providerSuccessRate >= PROXY_THRESHOLDS.minimumProviderSuccessRate,
    minimumMealNameAccuracy:
      summary.mealNameAccuracy >= PROXY_THRESHOLDS.minimumMealNameAccuracy,
    minimumIngredientRecall:
      summary.meanIngredientRecall >= PROXY_THRESHOLDS.minimumIngredientRecall,
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    status:
      failures.length === 0 ? "INFORMATIONAL_PASS" : "INFORMATIONAL_FAIL",
    passed: failures.length === 0,
    qualifiesNutritionAccuracy: false,
    thresholds: PROXY_THRESHOLDS,
    checks,
    failures,
  };
};
