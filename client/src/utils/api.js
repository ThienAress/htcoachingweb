import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// 🔥 REQUEST INTERCEPTOR (gắn access token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 🔥 RESPONSE INTERCEPTOR (auto refresh token)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // nếu token hết hạn
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken },
        );

        const newToken = res.data.token;

        // lưu token mới
        localStorage.setItem("token", newToken);
        localStorage.setItem("token_exp", Date.now() + 15 * 60 * 1000);

        // gắn lại header
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // gọi lại request cũ
        return api(originalRequest);
      } catch (error) {
        // refresh fail → logout
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");

        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  },
);

export default api;
