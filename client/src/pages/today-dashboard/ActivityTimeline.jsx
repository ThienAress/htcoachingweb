import { useQuery } from "@tanstack/react-query";
import { Clock3, RefreshCw } from "lucide-react";
import {
  getDailyJournalTimeline,
} from "../../services/dailyJournal.service";
import { activityActorLabel } from "./activityTimelinePresentation";

const formatTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export const ActivityTimeline = ({ dateKey, enabled }) => {
  const query = useQuery({
    queryKey: ["daily-journal-timeline", dateKey],
    queryFn: () =>
      getDailyJournalTimeline(dateKey).then(
        (response) => response.data.data,
      ),
    enabled,
    staleTime: 30_000,
  });

  return (
    <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Clock3 size={18} className="text-orange-400" />
        Hoạt động trong ngày
      </h2>
      {query.isLoading ? (
        <p className="mt-4 text-sm text-slate-400" role="status">
          Đang tải hoạt động...
        </p>
      ) : query.isError ? (
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <RefreshCw size={16} />
          Tải lại timeline
        </button>
      ) : query.data?.length ? (
        <ol className="mt-4 space-y-3">
          {query.data.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0"
            >
              <span>
                <span className="block text-sm text-slate-200">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {activityActorLabel(item.metadata?.actorRole)}
                </span>
              </span>
              <time
                dateTime={item.at}
                className="shrink-0 text-xs text-slate-500"
              >
                {formatTime(item.at)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Chưa có hoạt động đáng chú ý trong ngày này.
        </p>
      )}
    </section>
  );
};
