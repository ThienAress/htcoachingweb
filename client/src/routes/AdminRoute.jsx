import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "../services/trainerSubscription.service";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const requiresSubscription = user?.role === "user";
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["route-subscription", user?._id],
    enabled: requiresSubscription,
    queryFn: () =>
      getMySubscription()
        .then((res) => res.data.data)
        .catch(() => null),
    staleTime: 60_000,
  });

  // Fetch subscription cho user thường
  if (loading || (requiresSubscription && subLoading)) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin → chỉ vào /admin hoặc /trainer
  if (user.role === "admin") {
    if (!location.pathname.startsWith("/admin") && !location.pathname.startsWith("/trainer")) {
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
