import Cookies from "js-cookie";

// Hàm lấy CSRF token từ cookie
export const getCsrfToken = () => {
  return Cookies.get("csrfToken");
};

// Interceptor cho axios: tự động gắn X-CSRF-Token vào các request có method không an toàn
export const setupCsrfInterceptor = (api) => {
  api.interceptors.request.use((config) => {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (!safeMethods.includes(config.method.toUpperCase())) {
      const token = getCsrfToken();
      if (token) {
        config.headers["X-CSRF-Token"] = token;
      }
    }
    return config;
  });
};
