import api from "../utils/api";

export const getCurrentUser = async () => {
  const res = await api.get("/user/me");
  return res.data;
};

export const createTrainer = (data) => api.post("/user/create-trainer", data);
export const getTrainers = (page = 1, limit = 10, search = "") =>
  api.get(
    `/user/trainers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
  );
export const deleteTrainer = (id) => api.delete(`/user/trainers/${id}`);

export const getUsers = (page = 1, limit = 10, search = "") =>
  api.get(
    `/user/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
  );
export const deleteUser = (id) => api.delete(`/user/${id}`);

export const updateMyProfile = (data) => api.put("/user/me/profile", data);
export const updateMyAvatar = (formData) => api.put("/user/me/avatar", formData, {
  headers: {
    "Content-Type": "multipart/form-data",
  },
});
export const getMyOrders = async () => {
  const res = await api.get("/user/me/orders");
  return res.data;
};
export const getMyTransactions = async () => {
  const res = await api.get("/user/me/transactions");
  return res.data;
};
