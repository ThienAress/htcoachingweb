import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setRedirectTo("/login");
      setLoading(false);
      return;
    }

    try {
      const user = jwtDecode(token);

      // Kiểm tra hết hạn
      if (user.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        setRedirectTo("/login");
        setLoading(false);
        return;
      }

      // Kiểm tra role hợp lệ
      if (!["admin", "trainer"].includes(user.role)) {
        setRedirectTo("/login");
        setLoading(false);
        return;
      }

      // Trainer chỉ được vào các route bắt đầu bằng /trainer
      if (
        user.role === "trainer" &&
        !location.pathname.startsWith("/trainer")
      ) {
        setRedirectTo("/trainer");
        setLoading(false);
        return;
      }

      // Admin chỉ được vào các route bắt đầu bằng /admin
      if (user.role === "admin" && !location.pathname.startsWith("/admin")) {
        setRedirectTo("/admin");
        setLoading(false);
        return;
      }

      setRedirectTo(null);
      setLoading(false);
    } catch (err) {
      localStorage.removeItem("token");
      setRedirectTo("/login");
      setLoading(false);
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} />;
  }

  return children;
};

export default AdminRoute;
