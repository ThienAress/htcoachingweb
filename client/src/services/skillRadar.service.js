import api from "../utils/api";

export const getSkillRadar = (signal) =>
  api.get("/admin/skill-radar", { signal });
