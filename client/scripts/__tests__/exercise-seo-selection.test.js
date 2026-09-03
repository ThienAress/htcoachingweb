import { describe, expect, it } from "vitest";

import {
  isExerciseSeoEligible,
  selectExercisesForSeo,
} from "../exercise-seo-selection.js";

const description =
  "Giữ thân người ổn định trong suốt chuyển động, kiểm soát nhịp thở và biên độ, đồng thời dừng lại nếu tư thế không còn an toàn hoặc xuất hiện cảm giác đau bất thường.";

const descriptionFor = (name) =>
  `${description} Nội dung kiểm chứng riêng cho bài ${name}.`;

const stepDescription = (label) =>
  `${label} với tư thế chắc chắn, kiểm tra vị trí bàn chân, cột sống và nhịp thở trước khi chuyển sang bước tiếp theo.`;

const completeDifficulty = {
  coordination: 1,
  stability: 1,
  mobility: 1,
  setup: 1,
  errorConsequence: 1,
  rationale: "Bài tập cần kiểm soát đồng thời tư thế, biên độ và nhịp thở.",
};

const exercise = (id, name, overrides = {}) => ({
  _id: id,
  name,
  muscleGroup: "Chân",
  description: descriptionFor(name),
  imageUrl: `https://images.example.com/${id}.jpg`,
  instructions: [
    { title: "Chuẩn bị", description: stepDescription("Chuẩn bị") },
    { title: "Thực hiện", description: stepDescription("Thực hiện") },
    { title: "Kết thúc", description: stepDescription("Kết thúc") },
  ],
  technicalDifficulty: completeDifficulty,
  ...overrides,
});

const ids = {
  alpha: "64b000000000000000000001",
  bravo: "64b000000000000000000002",
  charlie: "64b000000000000000000003",
  delta: "64b000000000000000000004",
};

describe("exercise SEO selection", () => {
  it("keeps an eligible pinned cohort in the caller-provided order", () => {
    const selected = selectExercisesForSeo(
      [
        exercise(ids.alpha, "Alpha"),
        exercise(ids.bravo, "Bravo"),
        exercise(ids.charlie, "Charlie"),
      ],
      {
        pinnedIds: [ids.charlie, ids.alpha],
        limit: 2,
        minimum: 2,
        strict: true,
      },
    );

    expect(selected.map((item) => item._id)).toEqual([
      ids.charlie,
      ids.alpha,
    ]);
  });

  it("does not replace a missing pinned item with an unapproved candidate", () => {
    const selected = selectExercisesForSeo(
      [exercise(ids.alpha, "Alpha"), exercise(ids.bravo, "Bravo")],
      {
        pinnedIds: [ids.charlie, ids.alpha],
        limit: 2,
        minimum: 0,
      },
    );

    expect(selected.map((item) => item._id)).toEqual([ids.alpha]);
  });

  it("rejects thin descriptions, incomplete setup, invalid rubrics, and non-HTTPS images", () => {
    const candidates = [
      exercise(ids.alpha, "Thin", { description: "Mô tả ngắn." }),
      exercise(ids.bravo, "Two steps", {
        instructions: exercise(ids.bravo, "fixture").instructions.slice(0, 2),
      }),
      exercise(ids.charlie, "Empty step", {
        instructions: [
          ...exercise(ids.charlie, "fixture").instructions.slice(0, 2),
          { title: "", description: stepDescription("Kết thúc") },
        ],
      }),
      exercise(ids.delta, "Missing rubric", {
        technicalDifficulty: {
          coordination: 1,
          stability: 1,
          mobility: 1,
          setup: 1,
        },
      }),
      exercise("64b000000000000000000005", "HTTP image", {
        imageUrl: "http://images.example.com/http.jpg",
      }),
    ];

    expect(candidates.map(isExerciseSeoEligible)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("uses stable content signals and name instead of updatedAt for unpinned ties", () => {
    const selected = selectExercisesForSeo([
      exercise(ids.bravo, "Zulu", { updatedAt: "2099-01-01T00:00:00.000Z" }),
      exercise(ids.alpha, "Alpha", { updatedAt: "2020-01-01T00:00:00.000Z" }),
    ]);

    expect(selected.map((item) => item.name)).toEqual(["Alpha", "Zulu"]);
  });

  it.each([
    ["exact text", description],
    ["trimmed, case-folded text", `  ${description.toUpperCase()}  `],
    ["Unicode-normalized text", description.normalize("NFD")],
  ])("rejects %s duplicate descriptions in a strict cohort", (_, duplicate) => {
    expect(() =>
      selectExercisesForSeo(
        [
          exercise(ids.alpha, "Alpha", { description }),
          exercise(ids.bravo, "Bravo", { description: duplicate }),
        ],
        {
          pinnedIds: [ids.alpha, ids.bravo],
          limit: 2,
          minimum: 2,
          strict: true,
        },
      ),
    ).toThrow(/duplicate normalized exercise description/i);
  });

  it("deterministically keeps the higher-ranked description duplicate outside strict mode", () => {
    const lowerRanked = exercise(ids.alpha, "Alpha", { description });
    const higherRanked = exercise(ids.bravo, "Bravo", {
      description: `  ${description.toUpperCase()}  `,
      videoUrl: "https://videos.example.com/bravo.mp4",
    });

    const forward = selectExercisesForSeo([lowerRanked, higherRanked]);
    const reversed = selectExercisesForSeo([higherRanked, lowerRanked]);

    expect({
      forward: forward.map((item) => item._id),
      reversed: reversed.map((item) => item._id),
    }).toEqual({ forward: [ids.bravo], reversed: [ids.bravo] });
  });

  it("rejects duplicate pinned IDs instead of silently changing the cohort", () => {
    expect(() =>
      selectExercisesForSeo([exercise(ids.alpha, "Alpha")], {
        pinnedIds: [ids.alpha, ids.alpha],
      }),
    ).toThrow(/duplicate pinned exercise id/i);
  });

  it("fails strict selection when a pinned exercise is missing or ineligible", () => {
    expect(() =>
      selectExercisesForSeo(
        [
          exercise(ids.alpha, "Alpha"),
          exercise(ids.bravo, "Bravo", { description: "Quá ngắn." }),
        ],
        {
          pinnedIds: [ids.alpha, ids.bravo, ids.charlie],
          limit: 3,
          minimum: 3,
          strict: true,
        },
      ),
    ).toThrow(/pinned exercise.*missing or ineligible/i);
  });

  it("fails a strict release when too few exercises pass the quality gate", () => {
    expect(() =>
      selectExercisesForSeo([exercise(ids.alpha, "Alpha")], {
        limit: 2,
        minimum: 2,
        strict: true,
      }),
    ).toThrow(/at least 2 quality candidates/i);
  });
});
