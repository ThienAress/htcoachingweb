import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMySubscription } from "../services/trainerSubscription.service";
import { canAccessF1 } from "../utils/trainerEntitlements";

const AccessStatus = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-sm text-slate-300">
    {children}
  </div>
);

const F1Route = ({ children }) => {
  const { user, loading } = useAuth();
  const needsSubscription = Boolean(user && user.role !== "admin");
  const {
    data: subscription,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["route-subscription", user?._id],
    enabled: needsSubscription,
    queryFn: () => getMySubscription().then((response) => response.data.data),
    staleTime: 60_000,
  });

  if (loading || (needsSubscription && isLoading)) {
    return <AccessStatus>Đang kiểm tra quyền truy cập F1...</AccessStatus>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (needsSubscription && isError) {
    return (
      <AccessStatus>
        <div>
          <p>Không thể xác minh quyền truy cập F1.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 min-h-11 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white transition hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isFetching ? "Đang kiểm tra..." : "Thử lại"}
          </button>
        </div>
      </AccessStatus>
    );
  }

  if (!canAccessF1(user, subscription)) {
    return <Navigate to="/trainer" replace state={{ blockedFeature: "f1" }} />;
  }

  return children;
};

export default F1Route;
