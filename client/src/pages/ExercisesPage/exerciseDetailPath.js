export const slugifyExerciseName = (name) =>
  String(name || "bai-tap")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bai-tap";

export const getExerciseDetailPath = (exercise) =>
  `/exercises/${exercise._id}/${slugifyExerciseName(exercise.name)}/`;

export const isCanonicalExerciseDetailSlug = (exercise, routeSlug) =>
  Boolean(exercise?._id) &&
  String(routeSlug || "") === slugifyExerciseName(exercise?.name);
