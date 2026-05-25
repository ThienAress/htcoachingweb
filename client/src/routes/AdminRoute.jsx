import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { getMySubscription } from "../services/trainerSubscription.service";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(true);

  // Fetch subscription cho user thường
  useEffect(() => {
    if (user && user.role === "user") {
      getMySubscription()
        .then((res) => setSubscription(res.data.data))
        .catch(() => setSubscription(null))
        .finally(() => setSubLoading(false));
    } else {
      setSubLoading(false);
    }
  }, [user]);

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin → chỉ vào /admin
  if (user.role === "admin") {
    if (!location.pathname.startsWith("/admin")) {
      return <Navigate to="/admin" replace />;
    }
    return children;
  }

  // Trainer (role cũ) → chỉ vào /trainer
  if (user.role === "trainer") {
    if (!location.pathname.startsWith("/trainer")) {
      return <Navigate to="/trainer" replace />;
    }
    return children;
  }

  // User thường có active subscription → cho vào /trainer
  if (user.role === "user" && subscription) {
    if (!location.pathname.startsWith("/trainer")) {
      return <Navigate to="/trainer" replace />;
    }
    return children;
  }

  // Không có quyền
  return <Navigate to="/" replace />;
};

export default AdminRoute;
