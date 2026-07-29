import api from "../utils/api";

export const getTrainerClientOverview = (clientId, { dateKey, days }) =>
  api.get(
    "/trainer-client-overview/" + encodeURIComponent(clientId),
    { params: { dateKey, days } },
  );
