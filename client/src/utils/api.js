import axios from "axios";
import Cookies from "js-cookie";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

if (!API_URL) {
  throw new Error("❌ Missing VITE_API_URL in production");
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// ===== REQUEST INTERCEPTOR =====
// Gắn CSRF token cho các request không phải safe methods
api.interceptors.request.use(
  (config) => {
    const method = (config.method || "get").toUpperCase();
    const safeMethods = ["GET", "HEAD", "OPTIONS"];

    if (!safeMethods.includes(method)) {
      const csrfToken = Cookies.get("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ===== RESPONSE INTERCEPTOR =====
// Tự refresh khi accessToken hết hạn
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const requestUrl = originalRequest.url || "";
    const status = error.response?.status;

    const isUserMeRequest = requestUrl === "/user/me";
    const isRefreshRequest = requestUrl === "/auth/refresh";
    const isLoginRequest =
      requestUrl === "/auth/admin/login" ||
      requestUrl === "/auth/trainer/login";
    const isLogoutRequest = requestUrl === "/auth/logout";

    // /user/me bị 401 thì để AuthContext tự xử lý
    if (status === 401 && isUserMeRequest) {
      return Promise.reject(error);
    }

    // Không refresh cho login / logout / refresh itself
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshRequest || isLoginRequest || isLogoutRequest) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // QUAN TRỌNG: phải dùng api instance để đi đúng baseURL backend
        await api.post("/auth/refresh", {});
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
