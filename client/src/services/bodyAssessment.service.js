import api from "../utils/api";

const base = "/body-assessments";
const trainer = (clientId) => `${base}/trainer/clients/${encodeURIComponent(clientId)}`;
const period = (clientId, week) => `${trainer(clientId)}/${encodeURIComponent(week)}`;
export const listBodyAssessments = ({ clientId, page = 1, limit = 100, signal } = {}) =>
  api.get(clientId ? trainer(clientId) : base, { params: { page, limit }, signal });
export const getBodyAssessment = (clientId, week, signal) => api.get(period(clientId, week), { signal });
export const saveBodyAssessment = (clientId, week, payload) => api.put(period(clientId, week), payload);
export const publishBodyAssessment = (clientId, week, payload) => api.post(`${period(clientId, week)}/publish`, payload);

export const bodyAssessmentKey = (actorId, clientId, ...parts) =>
  ["body-assessments", String(actorId || ""), clientId ? String(clientId) : "self", ...parts];
