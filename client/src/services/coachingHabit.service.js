import api from "../utils/api";

export const listMyCoachingHabits = (dateKey) =>
  api.get("/coaching-habits/my", { params: { dateKey } });

export const createMyCoachingHabit = (data) =>
  api.post("/coaching-habits", data);

export const changeCoachingHabitStatus = (id, data) =>
  api.post(
    "/coaching-habits/" + encodeURIComponent(id) + "/status",
    data,
  );

export const listTrainerClientHabits = (clientId, dateKey) =>
  api.get(
    "/coaching-habits/trainer/clients/" + encodeURIComponent(clientId),
    { params: { dateKey } },
  );

export const createTrainerClientHabit = (clientId, data) =>
  api.post(
    "/coaching-habits/trainer/clients/" + encodeURIComponent(clientId),
    data,
  );
