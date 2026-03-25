import api from "../utils/api";

export const getCurrentUser = async () => {
  const res = await api.get("/user/me");
  return res.data;
};

export const createTrainer = (data) => api.post("/user/create-trainer", data);
export const getTrainers = () => api.get("/user/trainers");
export const deleteTrainer = (id) => api.delete(`/user/trainers/${id}`);

export const getUsers = () => api.get("/user/users"); // admin lấy danh sách user
export const deleteUser = (id) => api.delete(`/user/${id}`);
