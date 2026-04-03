import api from "../utils/api";

export const getFoods = (page = 1, limit = 10, search = "") => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search.trim()) {
    params.append("search", search.trim());
  }
  return api.get(`/foods?${params.toString()}`);
};

export const getFoodById = (id) => api.get(`/foods/${id}`);
export const createFood = (data) => api.post("/foods", data);
export const createManyFoods = (foodsArray) =>
  api.post("/foods/batch", { foods: foodsArray });
export const updateFood = (id, data) => api.put(`/foods/${id}`, data);
export const deleteFood = (id) => api.delete(`/foods/${id}`);
