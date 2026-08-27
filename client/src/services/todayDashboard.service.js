import api from "../utils/api";

export const getTodayDashboardDay = (dateKey) =>
  api.get("/today-dashboard/day/" + encodeURIComponent(dateKey));

export const getTodayProgressPromptEligibility = () =>
  api.get("/today-dashboard/prompt-eligibility");
