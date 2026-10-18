import api from "../utils/api";

export const checkMealPlanAccess = () => api.get("/meal-plan-access");

export const recordMealPlanGeneration = () => api.post("/meal-plan-access/usages");
