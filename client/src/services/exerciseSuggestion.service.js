import api from "../utils/api";

export const sendExerciseSuggestion = (suggestion) => {
  const normalized = String(suggestion || "").trim();
  return api.post("/exercise-suggestions", {
    name: normalized,
    description: normalized,
  });
};
export const getExerciseSuggestions = (
  page = 1,
  limit = 20,
  status = "",
  search = "",
) => {
  let url = `/exercise-suggestions?page=${page}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return api.get(url);
};
export const updateSuggestionStatus = (id, status, adminNote) =>
  api.patch(`/exercise-suggestions/${id}/status`, { status, adminNote });
export const deleteSuggestion = (id) =>
  api.delete(`/exercise-suggestions/${id}`);
