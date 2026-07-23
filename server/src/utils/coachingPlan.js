const MAX_PLAN_TITLE_LENGTH = 160;
const MAX_PLAN_NOTE_LENGTH = 5000;
const MAX_EXERCISES = 50;
const MAX_EXERCISE_NAME_LENGTH = 160;
const MAX_SHORT_FIELD_LENGTH = 50;
const MAX_MEDIA_URL_LENGTH = 2048;

const hasClientProgress = (exercise) =>
  Boolean(
    exercise.completed ||
      exercise.clientFeedbackNote ||
      exercise.clientFeedbackVideo,
  );

const validateString = (value, field, maxLength, required = false) => {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} là bắt buộc`);
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${field} phải là chuỗi`);
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw new Error(`${field} là bắt buộc`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${field} vượt quá giới hạn ${maxLength} ký tự`);
  }
  return normalized;
};

const validateMediaUrl = (value, field) => {
  const url = validateString(value, field, MAX_MEDIA_URL_LENGTH);
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error();
    }
    return url;
  } catch {
    throw new Error(`${field} không phải URL hợp lệ`);
  }
};

const validateDateString = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Ngày giáo án không hợp lệ");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Ngày giáo án không tồn tại");
  }
  return date;
};

const sanitizeTrainerExercise = (exercise, existingExercise) => {
  if (!exercise || typeof exercise !== "object") {
    throw new Error("Bài tập không hợp lệ");
  }

  const sets = Number(exercise.sets ?? 4);
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
    throw new Error("Số hiệp phải là số nguyên từ 1 đến 20");
  }

  const sanitized = {
    name: validateString(
      exercise.name,
      "Tên bài tập",
      MAX_EXERCISE_NAME_LENGTH,
      true,
    ),
    sets,
    reps: validateString(
      exercise.reps ?? "10-12",
      "Số lần lặp",
      MAX_SHORT_FIELD_LENGTH,
    ),
    weight: validateString(
      exercise.weight ?? "60s",
      "Mức tạ/thời gian nghỉ",
      MAX_SHORT_FIELD_LENGTH,
    ),
    videoUrl: validateMediaUrl(exercise.videoUrl ?? "", "Video demo 1"),
    videoUrl2: validateMediaUrl(exercise.videoUrl2 ?? "", "Video demo 2"),
  };

  if (existingExercise) {
    sanitized._id = existingExercise._id;
    sanitized.completed = existingExercise.completed;
    sanitized.clientFeedbackNote = existingExercise.clientFeedbackNote;
    sanitized.clientFeedbackVideo = existingExercise.clientFeedbackVideo;
  }

  return sanitized;
};

export const buildTrainerPlanUpdate = (payload, existingExercises = []) => {
  const date = validateDateString(payload.dateString);
  const title = validateString(
    payload.title,
    "Tiêu đề giáo án",
    MAX_PLAN_TITLE_LENGTH,
    true,
  );
  const note = validateString(
    payload.note ?? "",
    "Ghi chú giáo án",
    MAX_PLAN_NOTE_LENGTH,
  );
  const videoUrl = validateMediaUrl(
    payload.videoUrl ?? "",
    "Video tổng quan",
  );

  if (!Array.isArray(payload.exercises)) {
    throw new Error("Danh sách bài tập phải là một mảng");
  }
  if (payload.exercises.length > MAX_EXERCISES) {
    throw new Error(`Một giáo án chỉ được có tối đa ${MAX_EXERCISES} bài tập`);
  }

  const existingById = new Map(
    existingExercises.map((exercise) => [String(exercise._id), exercise]),
  );
  const retainedIds = new Set();

  const exercises = payload.exercises.map((exercise) => {
    const requestedId = exercise?._id ? String(exercise._id) : null;
    if (!requestedId) return sanitizeTrainerExercise(exercise, null);

    const existingExercise = existingById.get(requestedId);
    if (!existingExercise) {
      throw new Error("Bài tập không thuộc phiên bản giáo án hiện tại");
    }
    if (retainedIds.has(requestedId)) {
      throw new Error("Danh sách giáo án chứa bài tập bị trùng");
    }
    retainedIds.add(requestedId);
    return sanitizeTrainerExercise(exercise, existingExercise);
  });

  for (const existingExercise of existingExercises) {
    const id = String(existingExercise._id);
    if (!retainedIds.has(id) && hasClientProgress(existingExercise)) {
      throw new Error(
        "Không thể xóa bài tập đã có tiến trình hoặc phản hồi của học viên",
      );
    }
  }

  return {
    date,
    dateString: payload.dateString,
    title,
    note,
    videoUrl,
    exercises,
  };
};
