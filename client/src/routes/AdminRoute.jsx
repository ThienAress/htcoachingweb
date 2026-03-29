import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra role hợp lệ
  if (!["admin", "trainer"].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // Trainer chỉ được vào các route bắt đầu bằng /trainer
  if (user.role === "trainer" && !location.pathname.startsWith("/trainer")) {
    return <Navigate to="/trainer" replace />;
  }

  // Admin chỉ được vào các route bắt đầu bằng /admin
  if (user.role === "admin" && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default AdminRoute;
