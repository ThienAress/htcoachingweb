import api from "../utils/api";

export const getMyProgress = (days) =>
  api.get("/progress", { params: { days } });

export const getTrainerClientProgress = (clientId, days) =>
  api.get("/progress/trainer/clients/" + encodeURIComponent(clientId), {
    params: { days },
  });
