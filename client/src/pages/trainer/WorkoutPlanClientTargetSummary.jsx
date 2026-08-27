import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { getTrainerClientWellnessTarget } from "../../services/wellnessTarget.service";
import {
  buildTrainerHealthWorkspacePath,
  buildWellnessTargetSummary,
  getTrainerClientId,
} from "./trainerClientWorkspace.helpers";

export const WorkoutPlanClientTargetSummary = ({ clientId }) => {
  const normalizedClientId = getTrainerClientId({ _id: clientId });
  const query = useQuery({
    queryKey: ["wellness-target", "trainer", normalizedClientId],
    queryFn: async () =>
      (await getTrainerClientWellnessTarget(normalizedClientId)).data.data,
    enabled: Boolean(normalizedClientId),
    staleTime: 20_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  if (!normalizedClientId) return null;
  const items = buildWellnessTargetSummary(query.data);
  const workspacePath = buildTrainerHealthWorkspacePath(normalizedClientId, {
    tab: "tasks",
  });

  return (
    <section className="border-y border-cyan-900/60 py-4" aria-label="Mục tiêu sức khỏe hiện tại">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-100">
            Mục tiêu sức khỏe hiện tại
          </h3>
        </div>
        <Link
          to={workspacePath}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Chỉnh sửa tại Theo dõi sức khỏe
        </Link>
      </div>

      {query.isLoading ? (
        <div className="mt-3 h-10 animate-pulse rounded-lg bg-slate-800" role="status">
          <span className="sr-only">Đang tải mục tiêu sức khỏe...</span>
        </div>
      ) : query.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-300">
          <span>Không thể tải mục tiêu.</span>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Chưa thiết lập mục tiêu cho học viên này.
        </p>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.key}>
              <dt className="text-xs text-slate-400">{item.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-100">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};
