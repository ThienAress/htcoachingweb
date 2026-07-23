const MAX_EXERCISE_FEEDBACK_NOTE_LENGTH = 2000;
const MAX_FEEDBACK_VIDEO_URL_LENGTH = 2048;

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isAllowedFeedbackVideoUrl = (value) => {
  if (value === "") return true;
  if (value.startsWith("/uploads/")) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/htcoaching/coaching-videos/")
    );
  } catch {
    return false;
  }
};

export const parseExerciseFeedback = (rawExercises) => {
  if (rawExercises === undefined) return [];

  let exercises = rawExercises;
  if (typeof exercises === "string") {
    try {
      exercises = JSON.parse(exercises);
    } catch {
      throw new Error("Danh sách phản hồi bài tập không hợp lệ");
    }
  }

  if (!Array.isArray(exercises)) {
    throw new Error("Danh sách phản hồi bài tập phải là một mảng");
  }

  return exercises.map((exercise) => {
    if (!exercise || typeof exercise !== "object") {
      throw new Error("Phản hồi bài tập không hợp lệ");
    }

    const exerciseId = exercise.exerciseId || exercise._id;
    if (!exerciseId) {
      throw new Error("Thiếu mã bài tập trong phản hồi");
    }

    const update = { exerciseId: String(exerciseId) };

    if (hasOwn(exercise, "completed")) {
      if (typeof exercise.completed !== "boolean") {
        throw new Error("Trạng thái hoàn thành không hợp lệ");
      }
      update.completed = exercise.completed;
    }

    if (hasOwn(exercise, "clientFeedbackNote")) {
      if (
        typeof exercise.clientFeedbackNote !== "string" ||
        exercise.clientFeedbackNote.length > MAX_EXERCISE_FEEDBACK_NOTE_LENGTH
      ) {
        throw new Error("Cảm nhận bài tập không hợp lệ hoặc quá dài");
      }
      update.clientFeedbackNote = exercise.clientFeedbackNote;
    }

    if (hasOwn(exercise, "clientFeedbackVideo")) {
      if (
        typeof exercise.clientFeedbackVideo !== "string" ||
        exercise.clientFeedbackVideo.length > MAX_FEEDBACK_VIDEO_URL_LENGTH ||
        !isAllowedFeedbackVideoUrl(exercise.clientFeedbackVideo)
      ) {
        throw new Error("Đường dẫn video phản hồi không hợp lệ");
      }
      update.clientFeedbackVideo = exercise.clientFeedbackVideo;
    }

    return update;
  });
};

export const applyExerciseFeedback = (planExercises, rawExercises) => {
  const updates = parseExerciseFeedback(rawExercises);
  const exercisesById = new Map(
    planExercises.map((exercise) => [String(exercise._id), exercise]),
  );
  const seenIds = new Set();

  for (const update of updates) {
    if (seenIds.has(update.exerciseId)) {
      throw new Error("Phản hồi chứa mã bài tập bị trùng");
    }
    seenIds.add(update.exerciseId);

    const exercise = exercisesById.get(update.exerciseId);
    if (!exercise) {
      throw new Error("Bài tập không thuộc giáo án này");
    }

    if (update.completed !== undefined) {
      exercise.completed = update.completed;
    }
    if (update.clientFeedbackNote !== undefined) {
      exercise.clientFeedbackNote = update.clientFeedbackNote;
    }
    if (update.clientFeedbackVideo !== undefined) {
      exercise.clientFeedbackVideo = update.clientFeedbackVideo;
    }
  }

  return planExercises;
};
