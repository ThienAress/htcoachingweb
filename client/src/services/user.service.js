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
