import api from "../utils/api";

export const checkMealPlanAccess = () => api.get("/mealplan-access/check");

export const recordMealPlanGeneration = () => api.post("/mealplan-access/record");
