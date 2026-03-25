import api from "../utils/api";

// 🔥 login admin + trainer dùng chung
export const adminLogin = (data) => api.post("/auth/admin/login", data);
export const trainerLogin = (data) => api.post("/auth/trainer/login", data);
