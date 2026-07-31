import api from "../utils/api";

export const getTodayDashboardDay = (dateKey) =>
  api.get("/today-dashboard/day/" + encodeURIComponent(dateKey));
