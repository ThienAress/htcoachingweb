import api from "../utils/api";

export const getExercises = (page = 1, limit = 20, search = "") => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.append("search", search);
  return api.get(`/exercises?${params.toString()}`).then((res) => res.data);
};

export const createExercise = (data) => api.post("/exercises", data);
export const createManyExercises = (exercises) =>
  api.post("/exercises/batch", { exercises });
export const updateExercise = (id, data) => api.put(`/exercises/${id}`, data);
export const deleteExercise = (id) => api.delete(`/exercises/${id}`);
