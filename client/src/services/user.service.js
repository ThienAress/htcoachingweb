import api from "../utils/api";

export const getCurrentUser = async () => {
  const res = await api.get("/users/me");
  return res.data;
};

export const getUsers = (page = 1, limit = 10, search = "") =>
  api.get(
    `/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
  );
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const updateMyProfile = (data) => api.put("/users/me/profile", data);
export const updateMyAvatar = (formData) =>
  api.put("/users/me/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
export const getMyOrders = async ({ signal } = {}) => {
  const res = await api.get("/users/me/orders", { signal });
  return res.data;
};
export const getMyTransactions = async ({ signal } = {}) => {
  const res = await api.get("/users/me/transactions", { signal });
  return res.data;
};
export const getMyMealPlanPreferences = ({ signal } = {}) =>
  api
    .get("/users/me/meal-plan-preferences", { signal })
    .then((response) => response.data.data);
export const updateMyMealPlanPreferences = (preferences) =>
  api
    .put("/users/me/meal-plan-preferences", preferences)
    .then((response) => response.data.data);
export const deleteMyMealPlanPreferences = () =>
  api
    .delete("/users/me/meal-plan-preferences")
    .then((response) => response.data.data);
