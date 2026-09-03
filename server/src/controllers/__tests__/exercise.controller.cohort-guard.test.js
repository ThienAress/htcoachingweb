import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
  scheduleNetlifyBuild: vi.fn(),
}));

vi.mock("../../models/Exercise.js", () => ({
  default: {
    find: mocks.find,
    findById: mocks.findById,
    findByIdAndDelete: mocks.findByIdAndDelete,
  },
  deriveTechnicalDifficultyRating: vi.fn(() => null),
  TECHNICAL_DIFFICULTY_CRITERIA: [
    "coordination",
    "stability",
    "mobility",
    "setup",
    "errorConsequence",
  ],
}));

vi.mock("../../models/ExerciseReview.js", () => ({
  default: { deleteMany: vi.fn() },
}));

vi.mock("../../utils/cloudinaryUpload.js", () => ({
  destroyCloudinaryAsset: vi.fn(),
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  scheduleNetlifyBuild: mocks.scheduleNetlifyBuild,
}));

import { deleteExercise, updateExercise } from "../exercise.controller.js";

const PINNED_ID = "6a4b43515b0a4f47f1108990";
const DESCRIPTION = Array.from(
  { length: 20 },
  (_, index) => `quality${index}`,
).join(" ");
const INSTRUCTIONS = [
  { title: "Step 1", description: "a".repeat(80) },
  { title: "Step 2", description: "b".repeat(80) },
  { title: "Step 3", description: "c".repeat(80) },
];
const RUBRIC = {
  coordination: 1,
  stability: 1,
  mobility: 1,
  setup: 1,
  errorConsequence: 1,
};
const SIBLING_IDS = [
  "6a4b495ea5de82055378a732",
  "6a4b4998a5de82055378a7d4",
  "6a4b4991a5de82055378a7c2",
  "6a4b49aba5de82055378a80a",
  "6a4b49b4a5de82055378a823",
  "6a4b4a8ca5de82055378aa6e",
  "69d1362ea0f04831d73b8e0d",
  "6a4b4b44a5de82055378ac72",
  "6a4b4b4aa5de82055378ac81",
];

const makePinnedExercise = () => {
  const exercise = {
    _id: PINNED_ID,
    name: "3/4 Sit-up",
    muscleGroup: "Core",
    description: DESCRIPTION,
    imageUrl: "https://cdn.example.test/exercise.jpg",
    instructions: INSTRUCTIONS,
    technicalDifficulty: RUBRIC,
    isModified: vi.fn(() => true),
    save: vi.fn().mockResolvedValue(undefined),
  };
  exercise.toObject = vi.fn(() => ({ ...exercise }));
  return exercise;
};

const makeSiblings = (descriptionForIndex = (_, index) =>
  `${DESCRIPTION} sibling ${index}`) =>
  SIBLING_IDS.map((_id, index) => ({
    _id,
    description: descriptionForIndex(_id, index),
  }));

const mockSiblingQuery = (siblings = makeSiblings()) => {
  const lean = vi.fn().mockResolvedValue(siblings);
  mocks.find.mockReturnValue({ select: vi.fn(() => ({ lean })) });
};

const makeResponse = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const runUpdate = async (body, res = makeResponse()) => {
  const exercise = makePinnedExercise();
  mocks.findById.mockResolvedValue(exercise);
  await updateExercise({ params: { id: PINNED_ID }, body }, res);
  return { exercise, res };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSiblingQuery();
});

describe("pinned Exercise mutation guard", () => {
  it("blocks an update that makes the pinned exercise ineligible", async () => {
    const { exercise, res } = await runUpdate({
      imageUrl: "http://unsafe.test/x.jpg",
    });

    expect({
      saved: exercise.save.mock.calls.length,
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
      code: res.json.mock.calls[0]?.[0]?.details?.code,
    }).toEqual({
      saved: 0,
      scheduled: 0,
      status: 409,
      code: "PINNED_EXERCISE_INELIGIBLE",
    });
  });

  it("blocks a normalized description change before lookup or write", async () => {
    const { exercise, res } = await runUpdate({
      description: `${DESCRIPTION} safely`,
    });

    expect({
      siblingLookups: mocks.find.mock.calls.length,
      saved: exercise.save.mock.calls.length,
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
      code: res.json.mock.calls[0]?.[0]?.details?.code,
    }).toEqual({
      siblingLookups: 0,
      saved: 0,
      scheduled: 0,
      status: 409,
      code: "PINNED_EXERCISE_DESCRIPTION_CHANGE_BLOCKED",
    });
  });

  it("allows another eligible update and schedules one build", async () => {
    const { exercise } = await runUpdate({
      imageUrl: "https://cdn.example.test/exercise-updated.jpg",
    });

    expect({
      saved: exercise.save.mock.calls.length,
      reasons: mocks.scheduleNetlifyBuild.mock.calls,
    }).toEqual({ saved: 1, reasons: [["exercise_updated"]] });
  });

  it("blocks a normalized description duplicate", async () => {
    mockSiblingQuery(
      makeSiblings((_, index) =>
        index === 0 ? DESCRIPTION : `${DESCRIPTION} sibling ${index}`,
      ),
    );
    const { exercise, res } = await runUpdate({
      description: `  ${DESCRIPTION.toUpperCase()}  `,
    });

    expect({
      saved: exercise.save.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
      code: res.json.mock.calls[0]?.[0]?.details?.code,
    }).toEqual({
      saved: 0,
      status: 409,
      code: "PINNED_EXERCISE_DESCRIPTION_CONFLICT",
    });
  });

  it("fails closed when a pinned sibling cannot be verified", async () => {
    mockSiblingQuery(makeSiblings().slice(1));
    const { exercise, res } = await runUpdate({
      imageUrl: "https://cdn.example.test/exercise-updated.jpg",
    });

    expect({
      saved: exercise.save.mock.calls.length,
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
    }).toEqual({ saved: 0, scheduled: 0, status: 409 });
  });

  it("blocks deletion before touching a pinned Exercise", async () => {
    const res = makeResponse();
    await deleteExercise({ params: { id: PINNED_ID.toUpperCase() } }, res);

    expect({
      deleted: mocks.findByIdAndDelete.mock.calls.length,
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
      code: res.json.mock.calls[0]?.[0]?.details?.code,
    }).toEqual({
      deleted: 0,
      scheduled: 0,
      status: 409,
      code: "PINNED_EXERCISE_DELETE_BLOCKED",
    });
  });
});
