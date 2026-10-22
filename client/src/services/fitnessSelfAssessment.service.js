import api from "../utils/api";

export const getMySelfAssessment = ({ signal } = {}) =>
  api.get("/fitness-self-assessments/me", { signal });

export const listMySelfAssessments = ({ page = 1, limit = 10, signal } = {}) =>
  api.get("/fitness-self-assessments", { params: { page, limit }, signal });

export const saveSelfAssessmentDraft = (payload) =>
  api.put("/fitness-self-assessments/me/draft", payload);

export const submitSelfAssessment = (id) =>
  api.post("/fitness-self-assessments/" + encodeURIComponent(id) + "/submit", {});
