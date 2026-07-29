import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, TimerReset } from "lucide-react";
import { saveAs } from "file-saver";
import {
  exportCoachingActivity,
  getCoachingActivity,
} from "../../services/coachingActivity.service";

const LABELS = {
  daily_journal_submitted: "Đã gửi nhật ký ngày",
  daily_journal_updated: "Đã cập nhật nhật ký ngày",
  weekly_checkin_submitted: "Đã gửi Weekly Check-in",
  weekly_checkin_reviewed: "HLV đã review Weekly Check-in",
  weekly_checkin_updated: "Đã cập nhật Weekly Check-in",
  coaching_comment_create: "Đã tạo bình luận coaching",
  coaching_comment_edit: "Đã sửa bình luận coaching",
  coaching_comment_remove: "Đã gỡ bình luận coaching",
  training_schedule_completed: "Đã hoàn thành lịch tập",
  training_schedule_cancelled: "Lịch tập đã hủy",
  coaching_day_completed: "Đã hoàn thành Coaching Day",
  workout_plan_completed: "Đã hoàn thành giáo án",
};
const formatTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export const CoachingActivityPanel = ({ days, userId }) => {
  const query = useQuery({
    queryKey: ["coaching-activity", userId, days],
    queryFn: async () => (await getCoachingActivity(days)).data.data,
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
  const exportMutation = useMutation({
    mutationFn: (format) => exportCoachingActivity(days, format),
    onSuccess: (response, format) => {
      const blob =
        format === "csv"
          ? response.data
          : new Blob([JSON.stringify(response.data.data, null, 2)], {
              type: "application/json;charset=utf-8",
            });
      saveAs(blob, "coaching-activity-" + days + "d." + format);
    },
  });

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-white">
            <TimerReset size={19} className="text-orange-400" aria-hidden="true" />
            Activity timeline
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Chỉ gồm event, timestamp và source ID; không chứa nội dung sức khỏe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["json", "csv"].map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => exportMutation.mutate(format)}
              disabled={exportMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold uppercase text-slate-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
            >
              <Download size={15} aria-hidden="true" /> {format}
            </button>
          ))}
        </div>
      </div>
      {exportMutation.isError && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          Không thể export activity lúc này.
        </p>
      )}
      {query.isLoading ? (
        <div className="mt-4 h-28 animate-pulse rounded-xl bg-slate-900" role="status">
          <span className="sr-only">Đang tải activity...</span>
        </div>
      ) : query.isError ? (
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <RefreshCw size={16} aria-hidden="true" /> Tải lại activity
        </button>
      ) : query.data.items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          Chưa có activity trong khoảng này.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-800">
          {query.data.items.slice(0, 12).map((item) => (
            <li
              key={item.eventType + item.sourceId + item.occurredAt}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {LABELS[item.eventType] || item.eventType}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {item.targetType} · {item.sourceId}
                </p>
              </div>
              <time
                dateTime={item.occurredAt}
                className="shrink-0 text-xs text-slate-500"
              >
                {formatTime(item.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
