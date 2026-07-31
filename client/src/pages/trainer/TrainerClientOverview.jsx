import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTrainerClientOverview } from "../../services/trainerOverview.service";
import { purgeTrainerPrivateQueries } from "../../utils/trainerPrivateCache";
import { ProgressSummary } from "../progress/ProgressSummary";
import { CoachingCommentThread } from "../today-dashboard/CoachingCommentThread";
import { TrainerAttentionPanel } from "./TrainerAttentionPanel";
import { TrainerWeeklyReview } from "./TrainerWeeklyReview";
import { todayStatusLabel } from "./trainerOverviewPresentation";

const RANGES = [7, 30, 90];

export const TrainerClientOverview = ({ clientId, dateKey }) => {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const purgedForbiddenKeyRef = useRef(null);
  const queryKey = ["trainer-client-overview", clientId, dateKey, days];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await getTrainerClientOverview(clientId, {
          dateKey,
          days,
        })
      ).data.data,
    enabled: Boolean(clientId && dateKey),
    staleTime: 20_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const accessRevoked = query.error?.response?.status === 403;
  useEffect(() => {
    if (!accessRevoked) {
      if (query.isSuccess) purgedForbiddenKeyRef.current = null;
      return;
    }
    const forbiddenKey = [clientId, dateKey, days].join(":");
    if (purgedForbiddenKeyRef.current === forbiddenKey) return;
    purgedForbiddenKeyRef.current = forbiddenKey;
    queryClient.removeQueries({
      queryKey: ["trainer-client-overview"],
      type: "inactive",
    });
    void purgeTrainerPrivateQueries(queryClient, { type: "inactive" });
  }, [accessRevoked, clientId, dateKey, days, query.isSuccess, queryClient]);

  const setWeekly = (weeklyCheckin) => {
    queryClient.setQueryData(queryKey, (current) =>
      current ? { ...current, weeklyCheckin } : current,
    );
    void queryClient.invalidateQueries({ queryKey: ["progress"] });
  };

  const today = query.data?.today;
  const journal = today?.sections?.journal?.day;
  const coaching = today?.sections?.coaching?.day;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">Hôm nay và tiến trình</h2>
            <p className="text-xs text-gray-400 mt-0.5">Theo dõi kết quả luyện tập</p>
          </div>
        </div>

        {/* Range selector */}
        <div
          className="flex w-fit items-center gap-1 rounded-xl border border-gray-700 bg-gray-900/50 p-1"
          role="group"
          aria-label="Khoảng tiến trình khách hàng"
        >
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={
                "min-h-11 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
                (days === value
                  ? "bg-gray-700 text-white shadow-sm border border-gray-600"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white")
              }
            >
              {value} ngày
            </button>
          ))}
        </div>
      </div>

      <div>
        {query.isLoading ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">Đang tải tổng quan khách hàng...</span>
            <div className="h-24 animate-pulse rounded-xl bg-gray-800/60" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-800/40" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-800/60" />
          </div>
        ) : accessRevoked || query.isError ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
            <p className="text-sm text-red-300">
              {query.error?.response?.data?.message ||
                "Không thể tải tổng quan khách hàng."}
            </p>
            <button
              type="button"
              onClick={() => {
                void query.refetch();
              }}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw size={14} aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today status card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Trạng thái hôm nay</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {todayStatusLabel(today.summary.dayStatus)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <strong className="text-3xl font-bold tabular-nums text-orange-300">
                    {today.summary.completionPercent}
                    <span className="text-base font-bold text-orange-400/60">%</span>
                  </strong>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-orange-400 transition-[width] duration-200"
                  style={{ width: `${today.summary.completionPercent}%` }}
                  role="progressbar"
                  aria-valuenow={today.summary.completionPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={"Tiến độ Today: " + today.summary.completionPercent + "%"}
                />
              </div>
            </div>

            <TrainerAttentionPanel items={query.data.attention.items} />
            <ProgressSummary progress={query.data.progress} />
            <TrainerWeeklyReview
              key={
                (query.data.weeklyCheckin?._id || "missing") +
                ":" +
                (query.data.weeklyCheckin?.revision || 0)
              }
              clientId={clientId}
              checkin={query.data.weeklyCheckin}
              onChanged={setWeekly}
            />
            {journal?._id && (
              <CoachingCommentThread
                targetType="daily_journal"
                targetId={journal._id}
                title="Trao đổi về nhật ký ngày"
              />
            )}
            {coaching?._id && (
              <CoachingCommentThread
                targetType="coaching_day"
                targetId={coaching._id}
                title="Trao đổi về coaching day"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
};
