import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMock } = vi.hoisted(() => ({ findMock: vi.fn() }));

vi.mock("../../../../models/Exercise.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { find: findMock },
  };
});

import { searchExercises } from "../searchExercises.tool.js";

const mockExerciseQuery = (results = []) => {
  const chain = {
    sort: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    lean: vi.fn().mockResolvedValue(results),
  };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  findMock.mockReturnValue(chain);
  return chain;
};

describe("searchExercises query normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExerciseQuery();
  });

  it("extracts chest and no-equipment intent from a Vietnamese request", async () => {
    await searchExercises({
      searchQuery:
        "bài tập ngực không cần dụng cụ dành cho người mới, kèm số hiệp và số lần",
      limit: 5,
    });

    const query = findMock.mock.calls[0][0];
    expect(query.muscleGroup.$regex).toMatch(/ngực/i);
    expect(query.name.$regex).toMatch(/push/i);
    expect(query.name.$regex).not.toContain("bài tập ngực");
  });

  it("prioritizes low-difficulty exercises and demotes advanced variants for beginners", async () => {
    const beginnerDifficulty = {
      coordination: 0,
      stability: 0,
      mobility: 0,
      setup: 0,
      errorConsequence: 0,
    };
    const chain = mockExerciseQuery([
      { name: "Archer Push Up", muscleGroup: "Cơ ngực" },
      { name: "Incline Push Up", muscleGroup: "Cơ ngực", technicalDifficulty: beginnerDifficulty },
      { name: "Push Up", muscleGroup: "Cơ ngực" },
    ]);

    const result = await searchExercises({
      searchQuery: "bài tập ngực cho người mới",
      limit: 2,
    });

    expect(chain.limit).toHaveBeenCalledWith(15);
    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Incline Push Up",
      "Push Up",
    ]);
    expect(result.text).not.toContain("Archer Push Up");
  });

  it("maps an English muscle alias to Vietnamese and English catalog values", async () => {
    await searchExercises({ muscleGroup: "chest" });

    expect(findMock.mock.calls[0][0].muscleGroup.$regex).toMatch(/ngực/i);
    expect(findMock.mock.calls[0][0].muscleGroup.$regex).toMatch(/chest/i);
  });

  it("escapes a specific exercise name instead of treating it as a regex", async () => {
    await searchExercises({ searchQuery: "bench press (barbell)" });

    expect(findMock.mock.calls[0][0].name.$regex).toContain("\\(barbell\\)");
  });
});
