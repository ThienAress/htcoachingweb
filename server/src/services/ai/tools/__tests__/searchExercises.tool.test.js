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
    expect(query.name).toBeUndefined();
    expect(query.$or).toEqual([
      { name: expect.objectContaining({ $regex: expect.stringMatching(/push/i) }) },
      { description: expect.objectContaining({ $regex: expect.stringMatching(/body/i) }) },
      { "instructions.title": expect.objectContaining({ $regex: expect.stringMatching(/body/i) }) },
      { "instructions.description": expect.objectContaining({ $regex: expect.stringMatching(/body/i) }) },
    ]);
    expect(query.$or[0].name.$regex).not.toContain("bài tập ngực");
  });

  it("prefilters no-equipment evidence from description and instructions, not only the exercise name", async () => {
    mockExerciseQuery([
      {
        name: "Wall Press",
        muscleGroup: "Cơ ngực",
        description: "Bài bodyweight không cần dụng cụ cho người mới.",
      },
    ]);

    const result = await searchExercises({
      searchQuery: "bài tập ngực không cần dụng cụ cho người mới",
      limit: 1,
    });

    const query = findMock.mock.calls[0][0];
    expect(query.$or.map((condition) => Object.keys(condition)[0])).toEqual([
      "name",
      "description",
      "instructions.title",
      "instructions.description",
    ]);
    expect(result.uiCard.data.exercises).toEqual([
      expect.objectContaining({ name: "Wall Press" }),
    ]);
  });

  it("does not query the typed instruction DocumentArray as a raw regex field", async () => {
    await searchExercises({
      searchQuery: "bài tập ngực không cần dụng cụ cho người mới",
      limit: 1,
    });

    expect(findMock.mock.calls[0][0].$or).not.toContainEqual(
      expect.objectContaining({ instructions: expect.anything() }),
    );
  });

  it("excludes exercises whose setup contradicts an explicit no-equipment request", async () => {
    mockExerciseQuery([
      {
        name: "Push Up",
        muscleGroup: "Cơ ngực",
        description: "Chống đẩy trên sàn bằng trọng lượng cơ thể.",
      },
      {
        name: "Incline Push Up",
        muscleGroup: "Cơ ngực",
        description: "Đặt tay trên ghế bench.",
      },
      {
        name: "Chair Dip",
        muscleGroup: "Cơ ngực",
        instructions: [{ title: "Setup", description: "Dùng một chiếc ghế chắc chắn." }],
      },
      {
        name: "Band Push Up",
        muscleGroup: "Cơ ngực",
        description: "Quấn dây kháng lực sau lưng.",
      },
      {
        name: "TRX Push Up",
        muscleGroup: "Cơ ngực",
        description: "Giữ tay cầm suspension trainer.",
      },
    ]);

    const result = await searchExercises({
      searchQuery: "5 bài tập ngực không cần dụng cụ cho người mới",
      limit: 5,
    });

    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Push Up",
    ]);
    expect(result.meta).toMatchObject({
      equipmentConstraintApplied: true,
      excludedForEquipmentCount: 4,
    });
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

    expect(chain.limit).toHaveBeenCalledWith(101);
    expect(findMock.mock.calls[0][0].name).toBeUndefined();
    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Incline Push Up",
      "Push Up",
    ]);
    expect(result.text).not.toContain("Archer Push Up");
  });

  it("maps an English muscle alias to Vietnamese and English catalog values", async () => {
    const chain = mockExerciseQuery();
    await searchExercises({ muscleGroup: "chest", limit: 2 });

    expect(findMock.mock.calls[0][0].muscleGroup.$regex).toMatch(/ngực/i);
    expect(findMock.mock.calls[0][0].muscleGroup.$regex).toMatch(/chest/i);
    expect(chain.limit).toHaveBeenCalledWith(16);
  });

  it("escapes a specific exercise name instead of treating it as a regex", async () => {
    await searchExercises({ searchQuery: "bench press (barbell)" });

    expect(findMock.mock.calls[0][0].name.$regex).toContain("\\(barbell\\)");
  });

  it("excludes equipment the user does not have from a four-day dumbbell and band request", async () => {
    const chain = mockExerciseQuery([
      {
        name: "Barbell Bench Press",
        muscleGroup: "Cơ ngực",
        description: "Nằm trên ghế và dùng thanh đòn.",
      },
      {
        name: "Cable Chest Fly",
        muscleGroup: "Cơ ngực",
        description: "Dùng máy cáp tại phòng gym.",
      },
      {
        name: "Dumbbell Floor Press",
        muscleGroup: "Cơ ngực",
        description: "Nằm trên sàn, dùng tạ đơn điều chỉnh.",
        instructions: [{ title: "Setup", description: "Nằm trên sàn, không cần ghế." }],
      },
      {
        name: "Resistance Band Chest Press",
        muscleGroup: "Cơ ngực",
        description: "Dùng dây kháng lực neo chắc chắn.",
      },
    ]);

    const result = await searchExercises({
      searchQuery:
        "Lập lịch tập 4 ngày, tôi chỉ có tạ đơn điều chỉnh và dây kháng lực; không có ghế, máy, thanh đòn hay cáp.",
      limit: 3,
    });

    expect(chain.limit).toHaveBeenCalledWith(101);
    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Dumbbell Floor Press",
      "Resistance Band Chest Press",
    ]);
    expect(result.meta).toMatchObject({
      equipmentConstraintApplied: true,
      excludedForEquipmentCount: 2,
    });
  });
  it('keeps a specific name filter alongside generic equipment qualifiers', async () => {
    await searchExercises({muscleGroup:'Lưng', exerciseName:'Lat Pulldown', searchQuery:'bài tập Lưng lat pulldown người mới'});
    expect(findMock.mock.calls[0][0].name).toEqual({$regex:'Lat Pulldown', $options:'i'});
  });

  it("keeps a band-only request away from machine and bodyweight entries", async () => {
    mockExerciseQuery([
      {
        name: "Band Row",
        muscleGroup: "Lưng",
        description: "Kéo dây kháng lực về phía bụng.",
      },
      {
        name: "Assisted Pull-up",
        muscleGroup: "Cơ lưng",
        description: "Điều chỉnh máy hỗ trợ để kéo người lên.",
      },
      {
        name: "Inverted Row",
        muscleGroup: "Lưng",
        description: "Dùng trọng lượng cơ thể dưới thanh ngang.",
      },
    ]);

    const result = await searchExercises({
      searchQuery: "Tìm bài tập lưng cho người mới, chỉ dùng dây kháng lực",
      limit: 4,
    });

    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Band Row",
    ]);
    expect(result.meta).toMatchObject({
      equipmentConstraintApplied: true,
      excludedForEquipmentCount: 2,
    });
  });

  it("filters ambiguous presses and bodyweight exercises that require unavailable setup", async () => {
    mockExerciseQuery([
      {
        name: "Dumbbell Chest Press",
        muscleGroup: "Cơ ngực",
      },
      {
        name: "Pull Up",
        muscleGroup: "Cơ lưng",
        description: "Bodyweight pull-up trên xà đơn.",
      },
      {
        name: "Chair Dips",
        muscleGroup: "Cơ tay",
        description: "Bodyweight dips với ghế.",
      },
      {
        name: "Dumbbell Floor Press",
        muscleGroup: "Cơ ngực",
        description: "Nằm trên sàn và dùng tạ đơn.",
      },
    ]);

    const result = await searchExercises({
      searchQuery: "Tạo lịch tập chỉ có tạ đơn và dây kháng lực",
      limit: 5,
    });

    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Dumbbell Floor Press",
    ]);
  });

  it("excludes displaced fixtures, deduplicates catalog rows, and reports an insufficient compatible catalog", async () => {
    const chain = mockExerciseQuery([
      {
        name: "__plan079_displaced__Barbell Bench Press",
        muscleGroup: "Cơ ngực",
        description: "Dùng thanh đòn.",
        _stagingSearchIndexCohortDisplaced: { managed: true },
      },
      {
        name: "Dumbbell Floor Press",
        muscleGroup: "Cơ ngực",
        description: "Nằm trên sàn và dùng tạ đơn.",
      },
      {
        name: "  dumbbell floor press  ",
        muscleGroup: "Cơ ngực",
        description: "Bản sao catalog.",
      },
    ]);

    const result = await searchExercises({
      searchQuery: "bài tập ngực, tôi chỉ có tạ đơn và dây kháng lực",
      limit: 3,
    });

    expect(chain.limit).toHaveBeenCalledWith(101);
    expect(findMock.mock.calls[0][0].$and).toEqual(expect.arrayContaining([
      { _stagingSearchIndexCohortDisplaced: { $exists: false } },
      { name: { $not: /^__plan079_displaced__/i } },
    ]));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining("instructions"));
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining("_stagingSearchIndexCohortDisplaced"),
    );
    expect(result.uiCard.data.exercises.map(({ name }) => name)).toEqual([
      "Dumbbell Floor Press",
    ]);
    expect(result.meta).toMatchObject({
      requestedCount: 3,
      resultCount: 1,
      catalogInsufficient: true,
    });
    expect(result.uiCard.data).toMatchObject({
      requestedCount: 3,
      resultCount: 1,
      catalogInsufficient: true,
    });
    expect(result.text).toMatch(/chỉ có 1\/3 bài phù hợp/i);
  });

  it("reports an incomplete bounded scan instead of claiming the catalog is insufficient", async () => {
    mockExerciseQuery(Array.from({ length: 101 }, (_, index) => ({
      name: `Bench Push Up ${index}`,
      muscleGroup: "Cơ ngực",
      description: "Thực hiện với ghế bench.",
    })));

    const result = await searchExercises({
      searchQuery: "5 bài tập ngực không cần dụng cụ cho người mới",
      limit: 5,
    });

    expect(result.meta).toMatchObject({
      resultCount: 0,
      catalogInsufficient: false,
      scanIncomplete: true,
    });
    expect(result.text).toMatch(/chưa quét hết/i);
    expect(result.text).not.toMatch(/thư viện hiện chỉ có/i);
  });
});
