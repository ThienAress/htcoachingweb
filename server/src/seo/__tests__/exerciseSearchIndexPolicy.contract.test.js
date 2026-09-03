import { describe, expect, it } from "vitest";

import {
  isExerciseSeoEligible as isClientExerciseSeoEligible,
  selectExercisesForSeo as selectClientExercisesForSeo,
} from "../../../../client/scripts/exercise-seo-selection.js";
import {
  SEARCH_INDEX_EXERCISES as CLIENT_SEARCH_INDEX_EXERCISES,
  SEARCH_INDEX_EXERCISE_IDS as CLIENT_SEARCH_INDEX_EXERCISE_IDS,
} from "../../../../client/src/seo/searchIndexCohort.js";
import {
  isExerciseSeoEligible,
  isPinnedExerciseDescriptionCohortSafe,
  isPinnedExercisePostStateEligible,
  isSearchIndexExerciseId,
  normalizeExerciseSeoText,
  SEARCH_INDEX_EXERCISES,
  SEARCH_INDEX_EXERCISE_IDS,
} from "../exerciseSearchIndexPolicy.js";

const validDescription = Array.from(
  { length: 20 },
  (_, index) => `quality${index}`,
).join(" ");
const validInstructions = [
  { title: "Step 1", description: "a".repeat(80) },
  { title: "Step 2", description: "b".repeat(80) },
  { title: "Step 3", description: "c".repeat(80) },
];
const validRubric = {
  coordination: 1,
  stability: 1,
  mobility: 1,
  setup: 1,
  errorConsequence: 1,
};

const eligibleExercise = (overrides = {}) => ({
  _id: "6a4b43515b0a4f47f1108990",
  name: "3/4 Sit-up",
  muscleGroup: "Core",
  description: validDescription,
  imageUrl: "https://cdn.example.test/exercise.jpg",
  instructions: validInstructions,
  technicalDifficulty: validRubric,
  ...overrides,
});

describe("server Exercise search-index policy parity", () => {
  it("pins the exact client-owned Exercise cohort and editorial names", () => {
    expect({
      exercises: SEARCH_INDEX_EXERCISES,
      ids: SEARCH_INDEX_EXERCISE_IDS,
    }).toEqual({
      exercises: CLIENT_SEARCH_INDEX_EXERCISES,
      ids: CLIENT_SEARCH_INDEX_EXERCISE_IDS,
    });
  });

  it("matches the client hard eligibility boundary matrix", () => {
    const cases = [
      eligibleExercise(),
      eligibleExercise({ _id: "invalid-id" }),
      eligibleExercise({ name: "A" }),
      eligibleExercise({ muscleGroup: "A" }),
      eligibleExercise({ description: "word ".repeat(23).trim() }),
      eligibleExercise({ description: "singleword".repeat(12) }),
      eligibleExercise({ imageUrl: "http://cdn.example.test/exercise.jpg" }),
      eligibleExercise({ imageUrl: "https://user:pass@cdn.example.test/x.jpg" }),
      eligibleExercise({ instructions: validInstructions.slice(0, 2) }),
      eligibleExercise({
        instructions: [
          { title: "A", description: "a".repeat(80) },
          { title: "Step 2", description: "b".repeat(80) },
          { title: "Step 3", description: "c".repeat(80) },
        ],
      }),
      eligibleExercise({
        instructions: [
          { title: "Step 1", description: "a".repeat(39) },
          { title: "Step 2", description: "b".repeat(101) },
          { title: "Step 3", description: "c".repeat(100) },
        ],
      }),
      eligibleExercise({
        instructions: [
          { title: "Step 1", description: "a".repeat(80) },
          { title: "Step 2", description: "b".repeat(80) },
          { title: "Step 3", description: "c".repeat(79) },
        ],
      }),
      eligibleExercise({
        technicalDifficulty: { ...validRubric, coordination: 1.5 },
      }),
    ];

    const serverResults = cases.map(isExerciseSeoEligible);
    expect(serverResults).toEqual(cases.map(isClientExerciseSeoEligible));
    expect(serverResults).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("protects pinned ObjectIds case-insensitively and requires editorial identity", () => {
    expect({
      uppercaseId: isSearchIndexExerciseId("6A4B43515B0A4F47F1108990"),
      eligible: isPinnedExercisePostStateEligible(eligibleExercise()),
      renamed: isPinnedExercisePostStateEligible(
        eligibleExercise({ name: "Renamed Sit-up" }),
      ),
    }).toEqual({ uppercaseId: true, eligible: true, renamed: false });
  });

  it("matches the client strict-cohort description normalization", () => {
    const base = `Động tác ﬁtness ${validDescription}`;
    const variants = [
      base,
      `  ${base.toUpperCase()}  `,
      base.normalize("NFD"),
      base.replace(/ /g, "\t\n"),
      base.replace("Động", "Dong"),
      base.replace("ﬁtness", "fitness"),
      `${base} Nội dung khác hoàn toàn`,
    ];
    const clientTreatsAsDuplicate = (description) => {
      try {
        selectClientExercisesForSeo(
          [
            eligibleExercise({
              _id: SEARCH_INDEX_EXERCISE_IDS[0],
              description: base,
            }),
            eligibleExercise({
              _id: SEARCH_INDEX_EXERCISE_IDS[1],
              name: "Assisted Pull-up",
              description,
            }),
          ],
          {
            pinnedIds: SEARCH_INDEX_EXERCISE_IDS.slice(0, 2),
            limit: 2,
            minimum: 2,
            strict: true,
          },
        );
        return false;
      } catch (error) {
        if (/duplicate normalized exercise description/i.test(error.message)) {
          return true;
        }
        throw error;
      }
    };

    expect(
      variants.map(
        (description) =>
          normalizeExerciseSeoText(description) ===
          normalizeExerciseSeoText(base),
      ),
    ).toEqual(variants.map(clientTreatsAsDuplicate));
  });

  it("fails closed unless every pinned sibling has a unique description", () => {
    const exercise = eligibleExercise();
    const siblings = SEARCH_INDEX_EXERCISES.slice(1).map(({ id, name }, index) =>
      eligibleExercise({
        _id: id,
        name,
        description: `${validDescription} sibling ${index}`,
      }),
    );

    expect({
      safe: isPinnedExerciseDescriptionCohortSafe(exercise, siblings),
      missing: isPinnedExerciseDescriptionCohortSafe(
        exercise,
        siblings.slice(1),
      ),
      duplicate: isPinnedExerciseDescriptionCohortSafe(exercise, [
        { ...siblings[0], description: `  ${validDescription.toUpperCase()}  ` },
        ...siblings.slice(1),
      ]),
    }).toEqual({ safe: true, missing: false, duplicate: false });
  });
});
