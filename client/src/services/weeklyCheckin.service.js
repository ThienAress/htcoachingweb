import api from "../utils/api";

const base = (weekStartDateKey) =>
  "/weekly-checkins/" + encodeURIComponent(weekStartDateKey);

export const getWeeklyCheckin = (weekStartDateKey) =>
  api.get(base(weekStartDateKey));

export const saveWeeklyCheckin = (weekStartDateKey, payload) =>
  api.put(base(weekStartDateKey), payload);

export const submitWeeklyCheckin = (weekStartDateKey, payload) =>
  api.post(base(weekStartDateKey) + "/submit", payload);

export const correctWeeklyCheckin = (weekStartDateKey, payload) =>
  api.post(base(weekStartDateKey) + "/corrections", payload);

export const reviewTrainerWeeklyCheckin = (
  clientId,
  weekStartDateKey,
  payload,
) =>
  api.post(
    "/weekly-checkins/trainer/clients/" +
      encodeURIComponent(clientId) +
      "/" +
      encodeURIComponent(weekStartDateKey) +
      "/review",
    payload,
  );
