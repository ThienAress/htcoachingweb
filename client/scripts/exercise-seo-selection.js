import {
  completeExerciseSeoInstructions,
  hasExerciseSeoHttpsUrl,
  isExerciseSeoEligible,
  MIN_EXERCISE_SEO_DESCRIPTION_CHARACTERS,
  MIN_EXERCISE_SEO_INSTRUCTION_STEPS,
  MIN_EXERCISE_SEO_TOTAL_INSTRUCTION_CHARACTERS,
  normalizeExerciseSeoText,
} from "../src/seo/exerciseSearchIndexPolicy.js";

export { isExerciseSeoEligible };

const scoreExercise = (exercise) => {
  const descriptionLength = String(exercise.description).trim().length;
  const steps = completeExerciseSeoInstructions(exercise.instructions);
  const instructionLength = steps.reduce(
    (total, step) => total + String(step.description).trim().length,
    0,
  );
  const rationaleLength = String(
    exercise.technicalDifficulty?.rationale || "",
  ).trim().length;

  return (
    Math.min(
      Math.floor(
        (descriptionLength - MIN_EXERCISE_SEO_DESCRIPTION_CHARACTERS) / 30,
      ),
      4,
    ) +
    Math.min(steps.length - MIN_EXERCISE_SEO_INSTRUCTION_STEPS, 5) +
    Math.min(
      Math.floor(
        (instructionLength -
          MIN_EXERCISE_SEO_TOTAL_INSTRUCTION_CHARACTERS) /
          100,
      ),
      5,
    ) +
    (rationaleLength >= 40 ? 2 : 0) +
    (hasExerciseSeoHttpsUrl(exercise.videoUrl) ? 2 : 0)
  );
};

const rankedExercise = (exercise) => ({
  exercise,
  score: scoreExercise(exercise),
});

const compareRankedExercises = (left, right) =>
  right.score - left.score ||
  normalizeExerciseSeoText(left.exercise.name).localeCompare(
    normalizeExerciseSeoText(right.exercise.name),
  ) ||
  String(left.exercise._id).localeCompare(String(right.exercise._id));

const normalizedDescription = ({ exercise }) =>
  normalizeExerciseSeoText(exercise.description);

const findDuplicateDescription = (ranked) => {
  const firstByDescription = new Map();
  for (const candidate of ranked) {
    const key = normalizedDescription(candidate);
    if (firstByDescription.has(key)) {
      return [firstByDescription.get(key), candidate];
    }
    firstByDescription.set(key, candidate);
  }
  return null;
};

const dropLowerRankedDescriptionDuplicates = (ranked) => {
  const bestByDescription = new Map();
  for (const candidate of ranked) {
    const key = normalizedDescription(candidate);
    const current = bestByDescription.get(key);
    if (!current || compareRankedExercises(candidate, current) < 0) {
      bestByDescription.set(key, candidate);
    }
  }
  return ranked.filter(
    (candidate) =>
      bestByDescription.get(normalizedDescription(candidate)) === candidate,
  );
};

const validateSelectionOptions = ({ limit, minimum, pinnedIds }) => {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError("Exercise SEO selection limit must be a positive integer");
  }
  if (
    !Number.isSafeInteger(minimum) ||
    minimum < 0 ||
    minimum > limit
  ) {
    throw new TypeError(
      "Exercise SEO selection minimum must be between zero and limit",
    );
  }
  if (!Array.isArray(pinnedIds)) {
    throw new TypeError("Pinned exercise IDs must be an array");
  }
  if (pinnedIds.length > limit) {
    throw new Error("Pinned exercise IDs exceed the SEO selection limit");
  }
};

const normalizePinnedIds = (pinnedIds) => {
  const normalized = pinnedIds.map((value) => String(value || "").trim());
  if (normalized.some((id) => !/^[a-f0-9]{24}$/i.test(id))) {
    throw new Error("Pinned exercise ID must be a valid ObjectId");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Duplicate pinned exercise ID");
  }
  return normalized;
};

export const selectExercisesForSeo = (
  exercises,
  {
    limit = 20,
    minimum = 10,
    strict = false,
    pinnedIds = [],
  } = {},
) => {
  validateSelectionOptions({ limit, minimum, pinnedIds });
  const normalizedPinnedIds = normalizePinnedIds(pinnedIds);
  const candidates = (Array.isArray(exercises) ? exercises : []).filter(
    isExerciseSeoEligible,
  );
  const candidatesById = new Map(
    candidates.map((exercise) => [String(exercise._id), exercise]),
  );

  if (strict) {
    const missingPinnedId = normalizedPinnedIds.find(
      (id) => !candidatesById.has(id),
    );
    if (missingPinnedId) {
      throw new Error(
        `Pinned exercise ${missingPinnedId} is missing or ineligible`,
      );
    }
  }

  const pinnedIdSet = new Set(normalizedPinnedIds);
  const pinned = normalizedPinnedIds.flatMap((id) => {
    const exercise = candidatesById.get(id);
    return exercise ? [exercise] : [];
  });
  const ranked = normalizedPinnedIds.length > 0
    ? pinned.map(rankedExercise)
    : candidates
        .filter((exercise) => !pinnedIdSet.has(String(exercise._id)))
        .map(rankedExercise)
        .sort(compareRankedExercises);
  const strictCohort = ranked.slice(0, limit);

  if (strict) {
    const duplicate = findDuplicateDescription(strictCohort);
    if (duplicate) {
      throw new Error(
        `Duplicate normalized exercise description in strict SEO cohort: ${duplicate
          .map(({ exercise }) => String(exercise._id))
          .join(", ")}`,
      );
    }
  }

  const selected = (strict
    ? strictCohort
    : dropLowerRankedDescriptionDuplicates(ranked).slice(0, limit)
  ).map(({ exercise }) => exercise);

  if (strict && selected.length < minimum) {
    throw new Error(
      `Exercise SEO selection requires at least ${minimum} quality candidates; found ${selected.length}`,
    );
  }
  return selected;
};
