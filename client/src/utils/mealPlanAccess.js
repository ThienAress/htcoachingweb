export const deriveMealPlanAccess = (state) => {
  if (state?.accessLevel === "unlimited") {
    return { canGenerate: true, remainingGenerations: 0 };
  }
  if (
    state?.accessLevel !== "trial" ||
    !Number.isSafeInteger(state.generationCount) ||
    !Number.isSafeInteger(state.maxGenerations)
  ) {
    return { canGenerate: false, remainingGenerations: 0 };
  }
  const remainingGenerations = Math.max(
    0,
    state.maxGenerations - state.generationCount,
  );
  return {
    canGenerate: remainingGenerations > 0,
    remainingGenerations,
  };
};
