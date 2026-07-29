import api from "../utils/api";

export const getCoachingActivity = (days) =>
  api.get("/coaching-activity", { params: { days } });

export const exportCoachingActivity = (days, format) =>
  api.get("/coaching-activity/export", {
    params: { days, format },
    responseType: format === "csv" ? "blob" : "json",
  });
