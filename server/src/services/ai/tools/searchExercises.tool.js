// Search Exercises Tool — Query Exercise model từ MongoDB

import Exercise from "../../../models/Exercise.js";

/**
 * Tìm bài tập theo nhóm cơ hoặc tên
 * @param {{ muscleGroup?, searchQuery?, limit? }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function searchExercises(params) {
  const { muscleGroup, searchQuery, limit = 5 } = params;
  const query = {};

  if (muscleGroup) {
    query.muscleGroup = { $regex: muscleGroup, $options: "i" };
  }
  if (searchQuery) {
    query.name = { $regex: searchQuery, $options: "i" };
  }

  const exercises = await Exercise.find(query)
    .sort({ name: 1 })
    .limit(Math.min(limit, 10))
    .lean();

  if (exercises.length === 0) {
    return {
      text: muscleGroup
        ? `Không tìm thấy bài tập nào cho nhóm cơ "${muscleGroup}".`
        : `Không tìm thấy bài tập nào khớp với "${searchQuery}".`,
      uiCard: null,
    };
  }

  // Text cho LLM
  const exerciseList = exercises
    .map((e, i) => `${i + 1}. ${e.name} (${e.muscleGroup})${e.description ? ` — ${e.description}` : ""}`)
    .join("\n");

  const text = `Tìm thấy ${exercises.length} bài tập:\n${exerciseList}`;

  // Structured data cho FE render card
  const uiCard = {
    cardType: "exercise",
    data: {
      exercises: exercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        description: e.description || "",
        videoUrl: e.videoUrl || "",
        imageUrl: e.imageUrl || "",
      })),
      searchedFor: muscleGroup || searchQuery || "tất cả",
    },
  };

  return { text, uiCard };
}
