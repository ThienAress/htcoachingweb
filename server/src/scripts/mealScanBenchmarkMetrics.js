const NUTRIENT_KEYS = ["calories", "protein", "carb", "fat"];
const RANGE_KEYS = ["min", "estimate", "max"];
const HIDDEN_INGREDIENT_PATTERN =
  /\b(oil|butter|sauce|dressing|mayonnaise|mayo|syrup|cream|sugar)\b/i;
const HIDDEN_QUESTION_PATTERN =
  /\b(oil|butter|sauce|dressing|topping|added fat|cooking fat)\b/i;
const STOP_WORDS = new Set([
  "and",
  "with",
  "cooked",
  "fresh",
  "raw",
  "grilled",
  "roasted",
  "fried",
  "mixed",
  "the",
]);

const round = (value, decimals = 4) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const mean = (values) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const percentile = (values, ratio) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    Math.max(Math.ceil(sorted.length * ratio) - 1, 0),
    sorted.length - 1,
  );
  return sorted[index];
};

const percentError = (estimate, reference) =>
  reference > 0 ? (Math.abs(estimate - reference) / reference) * 100 : null;

const rangeContains = (range, reference) =>
  Number(range?.min) <= reference && reference <= Number(range?.max);

const tokenize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) || [];

const ingredientMatches = (referenceName, predictedLabel) => {
  const referenceTokens = new Set(tokenize(referenceName));
  return tokenize(predictedLabel).some((token) => referenceTokens.has(token));
};

const sumPortionRange = (items) =>
  Object.fromEntries(
    RANGE_KEYS.map((key) => [
      key,
      items.reduce(
        (sum, item) => sum + (Number(item?.portionGrams?.[key]) || 0),
        0,
      ),
    ]),
  );

const scoreMetric = (range, reference) => {
  const estimate = Number(range?.estimate) || 0;
  return {
    reference: round(reference),
    estimate: round(estimate),
    absoluteError: round(Math.abs(estimate - reference)),
    absolutePercentError: round(percentError(estimate, reference)),
    rangeContainsReference: rangeContains(range, reference),
  };
};

const summarizeMetric = (scores) => {
  const absoluteErrors = scores
    .map((score) => score.absoluteError)
    .filter(Number.isFinite);
  const percentErrors = scores
    .map((score) => score.absolutePercentError)
    .filter(Number.isFinite);
  return {
    meanAbsoluteError: round(mean(absoluteErrors)),
    meanAbsolutePercentError: round(mean(percentErrors)),
    medianAbsolutePercentError: round(percentile(percentErrors, 0.5)),
    p90AbsolutePercentError: round(percentile(percentErrors, 0.9)),
    rangeCoverage: round(
      mean(scores.map((score) => Number(score.rangeContainsReference))),
    ),
  };
};

export const scoreMealScanCase = (result, reference) => {
  const portionRange = sumPortionRange(result.items || []);
  const predictedLabels = (result.items || []).map((item) => item.label);
  const referenceIngredients = reference.ingredients || [];
  const ingredientHits = referenceIngredients.filter((ingredient) =>
    predictedLabels.some((label) => ingredientMatches(ingredient, label)),
  ).length;
  const questions = (result.questions || []).join(" ");

  return {
    confidence: result.confidence || "low",
    portion: scoreMetric(portionRange, reference.totalMass),
    nutrients: Object.fromEntries(
      NUTRIENT_KEYS.map((key) => [
        key,
        scoreMetric(result.total?.[key], reference.nutrients[key]),
      ]),
    ),
    ingredientRecall:
      referenceIngredients.length > 0
        ? round(ingredientHits / referenceIngredients.length)
        : null,
    hiddenIngredientPresent: referenceIngredients.some((ingredient) =>
      HIDDEN_INGREDIENT_PATTERN.test(ingredient),
    ),
    hiddenIngredientQuestion: HIDDEN_QUESTION_PATTERN.test(questions),
  };
};

export const summarizeMealScanBenchmark = (cases) => {
  const successfulCases = cases.filter((entry) => entry.success && entry.score);
  const scores = successfulCases.map((entry) => entry.score);
  const hiddenIngredientCases = scores.filter(
    (score) => score.hiddenIngredientPresent,
  );
  const failures = cases.filter((entry) => !entry.success);
  const confidenceLevels = ["high", "medium", "low"];

  return {
    attempted: cases.length,
    successful: successfulCases.length,
    failed: failures.length,
    providerSuccessRate: round(
      cases.length > 0 ? successfulCases.length / cases.length : 0,
    ),
    portion: summarizeMetric(scores.map((score) => score.portion)),
    nutrients: Object.fromEntries(
      NUTRIENT_KEYS.map((key) => [
        key,
        summarizeMetric(scores.map((score) => score.nutrients[key])),
      ]),
    ),
    meanIngredientRecall: round(
      mean(scores.map((score) => score.ingredientRecall).filter(Number.isFinite)),
    ),
    hiddenIngredientQuestionRecall: round(
      mean(
        hiddenIngredientCases.map((score) =>
          Number(score.hiddenIngredientQuestion),
        ),
      ),
    ),
    confidenceCalibration: Object.fromEntries(
      confidenceLevels.map((confidence) => {
        const group = scores.filter((score) => score.confidence === confidence);
        return [
          confidence,
          {
            count: group.length,
            calorieMedianAbsolutePercentError: round(
              percentile(
                group
                  .map(
                    (score) =>
                      score.nutrients.calories.absolutePercentError,
                  )
                  .filter(Number.isFinite),
                0.5,
              ),
            ),
            calorieRangeCoverage: round(
              mean(
                group.map((score) =>
                  Number(score.nutrients.calories.rangeContainsReference),
                ),
              ),
            ),
          },
        ];
      }),
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

const QUALITY_THRESHOLDS = {
  minimumSuccessfulSamples: 30,
  minimumProviderSuccessRate: 0.95,
  maximumMedianCaloriePercentError: 35,
  maximumMeanCaloriePercentError: 45,
  maximumP90CaloriePercentError: 80,
  minimumCalorieRangeCoverage: 0.7,
  minimumProteinRangeCoverage: 0.6,
  minimumCarbRangeCoverage: 0.6,
  minimumFatRangeCoverage: 0.6,
  minimumIngredientRecall: 0.6,
  minimumHighConfidenceCalorieRangeCoverage: 0.8,
  maximumMedianPortionPercentError: 45,
  maximumMedianProteinPercentError: 50,
  maximumMedianCarbPercentError: 50,
  maximumMedianFatPercentError: 60,
};

export const evaluateMealScanQuality = (summary) => {
  if ((summary.successful || 0) < QUALITY_THRESHOLDS.minimumSuccessfulSamples) {
    return {
      status: "INSUFFICIENT_DATA",
      passed: false,
      thresholds: QUALITY_THRESHOLDS,
      failures: ["minimumSuccessfulSamples"],
    };
  }

  const checks = {
    minimumProviderSuccessRate:
      summary.providerSuccessRate >=
      QUALITY_THRESHOLDS.minimumProviderSuccessRate,
    maximumMedianCaloriePercentError:
      summary.nutrients.calories.medianAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMedianCaloriePercentError,
    maximumMeanCaloriePercentError:
      summary.nutrients.calories.meanAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMeanCaloriePercentError,
    maximumP90CaloriePercentError:
      summary.nutrients.calories.p90AbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumP90CaloriePercentError,
    minimumCalorieRangeCoverage:
      summary.nutrients.calories.rangeCoverage >=
      QUALITY_THRESHOLDS.minimumCalorieRangeCoverage,
    minimumProteinRangeCoverage:
      summary.nutrients.protein.rangeCoverage >=
      QUALITY_THRESHOLDS.minimumProteinRangeCoverage,
    minimumCarbRangeCoverage:
      summary.nutrients.carb.rangeCoverage >=
      QUALITY_THRESHOLDS.minimumCarbRangeCoverage,
    minimumFatRangeCoverage:
      summary.nutrients.fat.rangeCoverage >=
      QUALITY_THRESHOLDS.minimumFatRangeCoverage,
    minimumIngredientRecall:
      summary.meanIngredientRecall >=
      QUALITY_THRESHOLDS.minimumIngredientRecall,
    minimumHighConfidenceCalorieRangeCoverage:
      summary.confidenceCalibration.high.count === 0 ||
      summary.confidenceCalibration.high.calorieRangeCoverage >=
        QUALITY_THRESHOLDS.minimumHighConfidenceCalorieRangeCoverage,
    maximumMedianPortionPercentError:
      summary.portion.medianAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMedianPortionPercentError,
    maximumMedianProteinPercentError:
      summary.nutrients.protein.medianAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMedianProteinPercentError,
    maximumMedianCarbPercentError:
      summary.nutrients.carb.medianAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMedianCarbPercentError,
    maximumMedianFatPercentError:
      summary.nutrients.fat.medianAbsolutePercentError <=
      QUALITY_THRESHOLDS.maximumMedianFatPercentError,
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    passed: failures.length === 0,
    thresholds: QUALITY_THRESHOLDS,
    checks,
    failures,
  };
};
