import { ArrowUpRight, History } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardList,
  CardSection,
  CardSectionLabel,
} from "./AssistantCard";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không rõ ngày"
    : date.toLocaleDateString("vi-VN");
};

export default function CheckinHistoryCard({ data }) {
  if (!data) return null;

  const activeOrders = data.activeOrders || [];
  const recentCheckins = data.recentCheckins || [];
  const primaryOrder = activeOrders[0];
  const totalSessions = Number(primaryOrder?.totalSessions) || 0;
  const usedSessions = Number(primaryOrder?.usedSessions) || 0;
  const progress = totalSessions
    ? Math.min(100, Math.max(0, Math.round((usedSessions / totalSessions) * 100)))
    : 0;

  if (!primaryOrder && recentCheckins.length === 0) return null;

  return (
    <AssistantCard
      eyebrow="LỊCH SỬ TẬP"
      icon={History}
      subtitle={primaryOrder?.gym || "Dữ liệu check-in gần nhất"}
      title={
        primaryOrder
          ? `${primaryOrder.package} · ${totalSessions || "—"} buổi`
          : "Các buổi tập gần đây"
      }
      value={
        primaryOrder
          ? `${primaryOrder.remainingSessions ?? "—"} buổi còn lại`
          : `${data.totalCheckins || recentCheckins.length} lượt`
      }
      valueNote={primaryOrder ? `${usedSessions} buổi đã dùng` : "đã check-in"}
      footer={
        <CardFooter
          action="Mở lịch sử tập"
          icon={ArrowUpRight}
          note={`Tổng cộng ${data.totalCheckins || recentCheckins.length} lượt check-in`}
          to="/my-history"
        />
      }
    >
      {primaryOrder && totalSessions > 0 && (
        <CardSection>
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <span>Tiến độ gói tập</span>
            <strong className="font-medium text-slate-900 dark:text-zinc-100">
              {progress}%
            </strong>
          </div>
          <div
            aria-label={`Đã sử dụng ${progress}% gói tập`}
            aria-valuemax="100"
            aria-valuemin="0"
            aria-valuenow={progress}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]"
            role="progressbar"
          >
            <span
              aria-hidden="true"
              className="block h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardSection>
      )}

      {recentCheckins.length > 0 && (
        <CardSection>
          <CardSectionLabel>Check-in gần đây</CardSectionLabel>
          <CardList>
            {recentCheckins.slice(0, 5).map((checkin, index) => (
              <li
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                key={`${checkin.time || "checkin"}-${index}`}
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                    {formatDate(checkin.time)}
                    {checkin.muscle ? ` · ${checkin.muscle}` : ""}
                  </p>
                  {(checkin.note || checkin.package) && (
                    <p className="mt-1 text-pretty text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      {[checkin.note, checkin.package].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </CardList>
        </CardSection>
      )}
    </AssistantCard>
  );
}
