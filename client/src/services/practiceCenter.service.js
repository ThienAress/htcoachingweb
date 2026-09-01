import api from "../utils/api";

export const getPracticeCenter = ({ signal } = {}) =>
  api.get("/practice-center", { signal });

export const sendPracticeCenterSimulation = (payload) =>
  api.post("/practice-center/send", payload);
