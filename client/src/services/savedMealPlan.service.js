import api from "../utils/api";

export const listSavedMealPlans = (params) =>
  api.get("/saved-meal-plans", { params });

export const getSavedMealPlan = (id) =>
  api.get("/saved-meal-plans/" + encodeURIComponent(id));

export const createSavedMealPlan = (data) =>
  api.post("/saved-meal-plans", data);

export const reviseSavedMealPlan = (id, data) =>
  api.post(
    "/saved-meal-plans/" + encodeURIComponent(id) + "/revisions",
    data,
  );

export const archiveSavedMealPlan = (id, data) =>
  api.post(
    "/saved-meal-plans/" + encodeURIComponent(id) + "/archive",
    data,
  );
