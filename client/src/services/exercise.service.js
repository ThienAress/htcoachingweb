import api from "../utils/api";

export const getExercises = (
  page = 1,
  limit = 20,
  search = "",
  muscleGroup = "",
  technicalDifficultyRating = "",
) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.append("search", search);
  if (muscleGroup) params.append("muscleGroup", muscleGroup);
  if (technicalDifficultyRating) {
    params.append("technicalDifficultyRating", technicalDifficultyRating);
  }
  return api.get(`/exercises?${params.toString()}`).then((res) => res.data);
};

export const getExerciseById = (id, signal) =>
  api.get(`/exercises/${id}`, { signal }).then((res) => res.data);

export const getExerciseReviews = (exerciseId, signal) =>
  api
    .get(`/exercises/${exerciseId}/reviews`, { signal })
    .then((res) => res.data);

export const saveExerciseReview = (exerciseId, data) =>
  api.put(`/exercises/${exerciseId}/reviews`, data).then((res) => res.data);

export const deleteExerciseReview = (exerciseId) =>
  api.delete(`/exercises/${exerciseId}/reviews`).then((res) => res.data);

export const createExercise = (data) => api.post("/exercises", data);
export const createManyExercises = (exercises) =>
  api.post("/exercises/batch", { exercises });
const importExerciseInstructions = (file, dryRun, previewToken) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dryRun", String(dryRun));
  if (previewToken) formData.append("previewToken", previewToken);
  return api
    .post("/exercises/instructions/import", formData)
    .then((res) => res.data);
};
export const previewExerciseInstructionsImport = (file) =>
  importExerciseInstructions(file, true);
export const commitExerciseInstructionsImport = (file, previewToken) =>
  importExerciseInstructions(file, false, previewToken);
export const updateExercise = (id, data) => api.put(`/exercises/${id}`, data);
export const deleteExercise = (id) => api.delete(`/exercises/${id}`);

export const uploadExerciseVideo = (id, file) => {
  const formData = new FormData();
  formData.append("video", file);
  return api
    .post(`/exercises/${id}/video`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

export const deleteExerciseVideo = (id) =>
  api.delete(`/exercises/${id}/video`).then((res) => res.data);
