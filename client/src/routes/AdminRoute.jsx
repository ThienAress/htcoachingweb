import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { mySubscriptionQueryOptions } from "../queries/subscription.queries";

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const requiresSubscription = user?.role === "user";
  const {
    data: subscription,
    isLoading: subLoading,
    isError: subError,
    isFetching: subFetching,
    refetch: refetchSubscription,
  } = useQuery(
    mySubscriptionQueryOptions({
      userId: user?._id,
      enabled: requiresSubscription,
    }),
  );

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

  if (requiresSubscription && subError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center text-slate-700">
        <p>Không thể xác minh gói huấn luyện viên của bạn.</p>
        <button
          type="button"
          onClick={() => refetchSubscription()}
          disabled={subFetching}
          className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-50"
        >
          {subFetching ? "Đang thử lại..." : "Thử lại"}
        </button>
      </div>
    );
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
