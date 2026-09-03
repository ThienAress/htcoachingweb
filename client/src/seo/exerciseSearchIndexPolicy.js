export const MIN_EXERCISE_SEO_DESCRIPTION_CHARACTERS = 120;
export const MIN_EXERCISE_SEO_DESCRIPTION_WORDS = 20;
export const MIN_EXERCISE_SEO_INSTRUCTION_STEPS = 3;
export const MIN_EXERCISE_SEO_STEP_DESCRIPTION_CHARACTERS = 40;
export const MIN_EXERCISE_SEO_TOTAL_INSTRUCTION_CHARACTERS = 240;

const TECHNICAL_DIFFICULTY_CRITERIA = [
  "coordination",
  "stability",
  "mobility",
  "setup",
  "errorConsequence",
];

export const normalizeExerciseSeoText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const wordCount = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;

export const hasExerciseSeoHttpsUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};

const hasCompleteTechnicalDifficulty = (value) =>
  value &&
  TECHNICAL_DIFFICULTY_CRITERIA.every((criterion) => {
    const score = value[criterion];
    return Number.isInteger(score) && score >= 0 && score <= 2;
  });

export const completeExerciseSeoInstructions = (value) => {
  if (
    !Array.isArray(value) ||
    value.length < MIN_EXERCISE_SEO_INSTRUCTION_STEPS
  ) {
    return [];
  }
  const steps = value.filter(
    (step) =>
      String(step?.title || "").trim().length >= 2 &&
      String(step?.description || "").trim().length >=
        MIN_EXERCISE_SEO_STEP_DESCRIPTION_CHARACTERS,
  );
  if (steps.length !== value.length) return [];
  const totalDescriptionCharacters = steps.reduce(
    (total, step) => total + String(step.description).trim().length,
    0,
  );
  return totalDescriptionCharacters >=
    MIN_EXERCISE_SEO_TOTAL_INSTRUCTION_CHARACTERS
    ? steps
    : [];
};

export const isExerciseSeoEligible = (exercise) => {
  const id = String(exercise?._id || "").trim();
  const name = String(exercise?.name || "").trim();
  const muscleGroup = String(exercise?.muscleGroup || "").trim();
  const description = String(exercise?.description || "").trim();

  return (
    /^[a-f0-9]{24}$/i.test(id) &&
    name.length >= 2 &&
    muscleGroup.length >= 2 &&
    description.length >= MIN_EXERCISE_SEO_DESCRIPTION_CHARACTERS &&
    wordCount(description) >= MIN_EXERCISE_SEO_DESCRIPTION_WORDS &&
    hasExerciseSeoHttpsUrl(exercise?.imageUrl) &&
    completeExerciseSeoInstructions(exercise?.instructions).length >=
      MIN_EXERCISE_SEO_INSTRUCTION_STEPS &&
    hasCompleteTechnicalDifficulty(exercise?.technicalDifficulty)
  );
};
