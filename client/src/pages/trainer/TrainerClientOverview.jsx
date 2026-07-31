import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
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
    <details
      open
      className="rounded-2xl border border-gray-700/40 bg-gray-900/70 p-5"
    >
      <summary className="min-h-11 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        <h2 className="flex min-h-11 items-center gap-2 font-bold text-white">
          <BarChart3 size={19} className="text-orange-400" aria-hidden="true" />
          Hôm nay và Tiến trình
        </h2>
      </summary>
      <div className="mt-4">
        <div
          className="flex flex-wrap gap-2"
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
                "min-h-11 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                (days === value
                  ? "border-orange-400 bg-orange-500/10 text-orange-200"
                  : "border-gray-700 text-gray-400 hover:bg-gray-800")
              }
            >
              {value} ngày
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-gray-950/60" role="status">
            <span className="sr-only">Đang tải tổng quan khách hàng...</span>
          </div>
        ) : accessRevoked || query.isError ? (
          <div className="mt-4 rounded-xl border border-red-900/60 p-4">
            <p className="text-sm text-red-300">
              {query.error?.response?.data?.message ||
                "Không thể tải tổng quan khách hàng."}
            </p>
            <button
              type="button"
              onClick={() => {
                void query.refetch();
              }}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-200 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw size={16} aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">Trạng thái hôm nay</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {todayStatusLabel(today.summary.dayStatus)}
                  </p>
                </div>
                <strong className="text-2xl text-orange-300">
                  {today.summary.completionPercent}%
                </strong>
              </div>
              <progress
                value={today.summary.completionPercent}
                max="100"
                className="mt-4 h-2 w-full accent-orange-500"
                aria-label={
                  "Tiến độ Today: " + today.summary.completionPercent + "%"
                }
              />
            </section>
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
    </details>
  );
};
