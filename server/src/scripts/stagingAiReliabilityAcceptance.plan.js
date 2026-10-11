import corpus from "../services/ai/evals/corpus/ai-eval-corpus.v1.json" with { type: "json" };

const SCENARIOS = [
  ["incident-breakfast-500-kcal-answer-first", "semantic-q1-breakfast-numeric"],
  ["incident-bodyweight-chest-exercises-answer-first", "semantic-q2-bodyweight-exercise-card"],
  ["incident-four-day-muscle-plan-not-public-person", "semantic-q3-four-day-workout"],
  ["incident-deficit-follow-up-stays-direct", "semantic-q4-deficit-scope-preserved"],
  ["incident-seven-day-fat-loss-plan-answer-first", "semantic-q5-seven-day-coverage"],
  ["incident-lifestyle-follow-up-stays-direct", "semantic-q6-retry-context-continuity"],
  ["adversarial-meal-2500-hard-constraints", "semantic-q7-hard-constraint-meal"],
  ["adversarial-meal-follow-up-preserves-scope", "semantic-q8-scoped-meal-adjustment"],
  ["adversarial-ronaldo-routine-needs-vetted-source", "semantic-q9-grounded-public-person-search"],
  ["adversarial-workout-multi-constraint-answer-first", "semantic-q10-equipment-safe-workout"],
  ["adversarial-calorie-request-asks-for-missing-data", "semantic-q11-prioritized-intake"],
];

const fail = () => {
  const error = new Error("Reliability corpus does not contain the exact eleven prompt contracts");
  error.code = "STAGING_AI_RELIABILITY_CORPUS_INVALID";
  throw error;
};

export const reliabilityPlan = () => {
  const byId = new Map(corpus.scenarios.map((scenario) => [scenario.id, scenario]));
  if (SCENARIOS.length !== 11 || new Set(SCENARIOS.flat()).size !== 22) fail();
  return SCENARIOS.map(([routeId, semanticId], index) => {
    const route = byId.get(routeId);
    const semantic = byId.get(semanticId);
    if (route?.evaluator !== "request_router_contract" ||
        semantic?.evaluator !== "semantic_output_contract" ||
        typeof route.input?.message !== "string" || !route.input.message.trim() ||
        !Array.isArray(semantic.expected?.rules)) fail();
    return Object.freeze({
      number: index + 1,
      scenarioId: routeId,
      message: route.input.message,
      expectedPath: route.expected.pathEquals,
      rules: semantic.expected.rules.filter((rule) => rule.type !== "retry_continuity"),
      followUpTo: ({ 6: 11, 8: 7 })[index + 1] || null,
    });
  });
};
