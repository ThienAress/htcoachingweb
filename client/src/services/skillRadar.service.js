import api from "../utils/api";

export const getSkillRadar = (signal) =>
  api.get("/admin/skill-radar", { signal });

export const previewSkillRadarSource = (sourceUrl) =>
  api.post("/admin/skill-radar/preview", { sourceUrl });

export const createSkillRadarSource = (source) =>
  api.post("/admin/skill-radar/sources", source);
