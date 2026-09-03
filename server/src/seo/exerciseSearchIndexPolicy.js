// Runtime copy of the client release cohort. The cross-package contract test must
// stay green whenever either side changes.
export const SEARCH_INDEX_EXERCISES = Object.freeze(
  [
    ["6a4b43515b0a4f47f1108990", "3/4 Sit-up"],
    ["6a4b495ea5de82055378a732", "Assisted Pull-up"],
    ["6a4b4998a5de82055378a7d4", "Band Squat"],
    ["6a4b4991a5de82055378a7c2", "Band Shoulder Press"],
    ["6a4b49aba5de82055378a80a", "Barbell Bench Press"],
    ["6a4b49b4a5de82055378a823", "Barbell Deadlift"],
    ["6a4b4a8ca5de82055378aa6e", "Cable Lat Pulldown Full Range Of Motion"],
    ["69d1362ea0f04831d73b8e0d", "Diamond Push-up"],
    ["6a4b4b44a5de82055378ac72", "Dumbbell Biceps Curl"],
    ["6a4b4b4aa5de82055378ac81", "Dumbbell Burpee"],
  ].map(([id, name]) => Object.freeze({ id, name })),
);

export const SEARCH_INDEX_EXERCISE_IDS = Object.freeze(
  SEARCH_INDEX_EXERCISES.map(({ id }) => id),
);

const expectedNameById = new Map(
  SEARCH_INDEX_EXERCISES.map(({ id, name }) => [id, name]),
);
const TECHNICAL_DIFFICULTY_CRITERIA = [
  "coordination",
  "stability",
  "mobility",
  "setup",
  "errorConsequence",
];
const MIN_DESCRIPTION_CHARACTERS = 120;
const MIN_DESCRIPTION_WORDS = 20;
const MIN_INSTRUCTION_STEPS = 3;
const MIN_STEP_DESCRIPTION_CHARACTERS = 40;
const MIN_TOTAL_INSTRUCTION_CHARACTERS = 240;

const normalizeId = (value) => String(value || "").trim().toLowerCase();

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

const hasHttpsUrl = (value) => {
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

const hasCompleteInstructions = (value) => {
  if (!Array.isArray(value) || value.length < MIN_INSTRUCTION_STEPS) {
    return false;
  }
  if (
    value.some(
      (step) =>
        String(step?.title || "").trim().length < 2 ||
        String(step?.description || "").trim().length <
          MIN_STEP_DESCRIPTION_CHARACTERS,
    )
  ) {
    return false;
  }
  return (
    value.reduce(
      (total, step) => total + String(step.description).trim().length,
      0,
    ) >= MIN_TOTAL_INSTRUCTION_CHARACTERS
  );
};

export const isExerciseSeoEligible = (exercise) => {
  const id = normalizeId(exercise?._id);
  const name = String(exercise?.name || "").trim();
  const muscleGroup = String(exercise?.muscleGroup || "").trim();
  const description = String(exercise?.description || "").trim();

  return (
    /^[a-f0-9]{24}$/.test(id) &&
    name.length >= 2 &&
    muscleGroup.length >= 2 &&
    description.length >= MIN_DESCRIPTION_CHARACTERS &&
    wordCount(description) >= MIN_DESCRIPTION_WORDS &&
    hasHttpsUrl(exercise?.imageUrl) &&
    hasCompleteInstructions(exercise?.instructions) &&
    hasCompleteTechnicalDifficulty(exercise?.technicalDifficulty)
  );
};

export const isSearchIndexExerciseId = (id) =>
  expectedNameById.has(normalizeId(id));

export const isPinnedExercisePostStateEligible = (exercise) => {
  const id = normalizeId(exercise?._id);
  const expectedName = expectedNameById.get(id);
  return Boolean(
    expectedName &&
      exercise?.name === expectedName &&
      isExerciseSeoEligible(exercise),
  );
};

export const isPinnedExerciseDescriptionCohortSafe = (
  exercise,
  siblings = [],
) => {
  const exerciseId = normalizeId(exercise?._id);
  if (!expectedNameById.has(exerciseId) || !Array.isArray(siblings)) {
    return false;
  }

  const expectedSiblingIds = new Set(
    SEARCH_INDEX_EXERCISE_IDS.filter((id) => id !== exerciseId),
  );
  const actualSiblingIds = new Set(
    siblings.map(({ _id }) => normalizeId(_id)).filter(Boolean),
  );
  if (
    actualSiblingIds.size !== expectedSiblingIds.size ||
    [...expectedSiblingIds].some((id) => !actualSiblingIds.has(id))
  ) {
    return false;
  }

  const descriptions = [exercise, ...siblings].map(({ description }) =>
    normalizeExerciseSeoText(description),
  );
  return (
    descriptions.every(Boolean) &&
    new Set(descriptions).size === SEARCH_INDEX_EXERCISE_IDS.length
  );
};
