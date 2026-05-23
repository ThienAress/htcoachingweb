import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Tự động cuộn lên đầu trang mỗi khi người dùng chuyển sang route mới.
 * Đặt component này bên trong <BrowserRouter> và bên trong MainLayout hoặc AppContent.
 */
const ScrollRestoration = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
};

export default ScrollRestoration;
