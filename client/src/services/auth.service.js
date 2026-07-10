import api from "../utils/api";

// 🔥 login trainer dùng password
export const trainerLogin = (data) => api.post("/auth/trainer/login", data);

