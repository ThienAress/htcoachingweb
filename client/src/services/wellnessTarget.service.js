import api from "../utils/api";

export const getMyWellnessTarget = (dateKey) =>
  api.get("/wellness-targets/me", { params: { dateKey } });

export const getTrainerClientWellnessTarget = (clientId) =>
  api.get(
    "/wellness-targets/trainer/clients/" + encodeURIComponent(clientId),
  );

export const updateTrainerClientWellnessTarget = (clientId, data) =>
  api.put(
    "/wellness-targets/trainer/clients/" + encodeURIComponent(clientId),
    data,
  );
