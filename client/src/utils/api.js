import axios from "axios";

import Cookies from "js-cookie";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

// Request interceptor: gắn CSRF token
api.interceptors.request.use((config) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (!safeMethods.includes(config.method.toUpperCase())) {
    const csrfToken = Cookies.get("csrfToken");
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

// Response interceptor: xử lý refresh, bỏ log 401 cho /user/me
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isUserMeRequest = originalRequest?.url === "/user/me";

    // Nếu là lỗi 401 của /user/me, không log, chỉ reject để AuthProvider xử lý
    if (error.response?.status === 401 && isUserMeRequest) {
      return Promise.reject(error);
    }

    // Các lỗi 401 khác: thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`/api/auth/refresh`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
