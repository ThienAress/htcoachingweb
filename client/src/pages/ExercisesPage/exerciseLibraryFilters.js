const normalizeSearchValue = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

export const filterExerciseCatalog = (
  exercises,
  { searchTerm = "", muscleGroup = "", difficulty = "" } = {},
) => {
  const normalizedSearch = normalizeSearchValue(searchTerm);

  return exercises.filter((exercise) => {
    const searchableText = normalizeSearchValue(
      [exercise.name, exercise.muscleGroup, exercise.description].join(" "),
    );
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
    const matchesMuscleGroup = !muscleGroup || exercise.muscleGroup === muscleGroup;
    const matchesDifficulty = !difficulty
      || (difficulty === "unrated"
        ? exercise.technicalDifficultyRating == null
        : exercise.technicalDifficultyRating === Number(difficulty));

    return matchesSearch && matchesMuscleGroup && matchesDifficulty;
  });
};
