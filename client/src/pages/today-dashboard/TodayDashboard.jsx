import {
  ArrowRight,
  CalendarClock,
  Dumbbell,
  NotebookPen,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { dashboardPathFor } from "../../utils/customerDashboardNavigation";

const dayStatusLabel = (status) =>
  ({
    not_started: "Chưa bắt đầu",
    in_progress: "Đang thực hiện",
    completed: "Đã hoàn thành",
    submitted: "Đã gửi HLV",
    rest_day: "Ngày nghỉ",
  })[status] || "Đang cập nhật";

const dayStatusColor = (status) =>
  ({
    not_started: "text-slate-400",
    in_progress: "text-cyan-400",
    completed: "text-emerald-400",
    submitted: "text-violet-400",
    rest_day: "text-slate-400",
  })[status] || "text-slate-400";

const dayStatusBg = (status) =>
  ({
    not_started: "bg-slate-800/60 border-slate-700",
    in_progress: "bg-cyan-500/10 border-cyan-500/30",
    completed: "bg-emerald-500/10 border-emerald-500/30",
    submitted: "bg-violet-500/10 border-violet-500/30",
    rest_day: "bg-slate-800/60 border-slate-700",
  })[status] || "bg-slate-800/60 border-slate-700";

/* SVG Progress Ring */
const ProgressRing = ({ percent = 0, size = 80, stroke = 7, color = "#f97316" }) => {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-slate-800"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

const MODULE_CONFIG = {
  training: {
    icon: Dumbbell,
    label: "Lịch & bài tập",
    description: "Huấn luyện, giáo án và điểm danh.",
    accent: "cyan",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-400",
    border: "border-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/40",
    arrowHover: "group-hover:text-cyan-400",
    statusColor: "text-cyan-300",
  },
  nutrition: {
    icon: Utensils,
    label: "Dinh dưỡng",
    description: "Thực đơn và ghi lại bữa ăn.",
    accent: "emerald",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    arrowHover: "group-hover:text-emerald-400",
    statusColor: "text-emerald-300",
  },
  journal: {
    icon: NotebookPen,
    label: "Nhật ký & thói quen",
    description: "Sức khỏe, thói quen và báo cáo tuần.",
    accent: "amber",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    arrowHover: "group-hover:text-amber-400",
    statusColor: "text-amber-300",
  },
  progress: {
    icon: TrendingUp,
    label: "Tổng quan",
    description: "Số liệu tổng hợp và xu hướng.",
    accent: "violet",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    border: "border-violet-500/20",
    hoverBorder: "hover:border-violet-500/40",
    arrowHover: "group-hover:text-violet-400",
    statusColor: "text-violet-300",
  },
};

const TodayDashboard = () => {
  const { data, dateKey } = useOutletContext();
  const scheduleItems = data.sections.schedule.items || [];
  const nextSchedule = scheduleItems[0] || null;
  const moduleProgress = data.summary.moduleProgress;
  const trainingProgress = moduleProgress.training;
  const nutritionProgress = moduleProgress.nutrition;
  const journalProgress = moduleProgress.journal;
  const completionPercent = data.summary.completionPercent;
  const dayStatus = data.summary.dayStatus;

  const moduleStatuses = {
    training: nextSchedule
      ? nextSchedule.startTime + " · " + nextSchedule.exerciseType
      : trainingProgress.percent === null
        ? "Không có nhiệm vụ"
        : "Tiến độ tập luyện " + trainingProgress.percent + "%",
    nutrition:
      nutritionProgress.percent === null
        ? "Chưa có thực đơn áp dụng"
        : "Tiến độ thực đơn " + nutritionProgress.percent + "%",
    journal: "Nhật ký: " + journalProgress.percent + "% hoàn thành",
    progress: "Mở trang tổng quan",
  };
  const ringColor =
    completionPercent >= 100
      ? "#34d399"
      : completionPercent >= 50
        ? "#22d3ee"
        : "#f97316";

  return (
    <div className="space-y-5">
      {/* ── Hero: Việc tiếp theo ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-800/50 p-5 shadow-lg ring-1 ring-inset ring-white/[0.04] sm:p-6">
        {/* Ambient glow background */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              Việc tiếp theo
            </div>

            {nextSchedule ? (
              <>
                <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                  {nextSchedule.exerciseType}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {nextSchedule.startTime}–{nextSchedule.endTime}
                  {nextSchedule.notes ? " · " + nextSchedule.notes : ""}
                </p>
                <Link
                  to={dashboardPathFor("training", dateKey)}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                >
                  Mở lịch &amp; bài tập <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                  Hoàn thiện nhật ký trong ngày
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Hôm nay chưa có lịch tập. Bạn vẫn có thể cập nhật sức khỏe, bữa ăn và thói quen.
                </p>
                <Link
                  to={dashboardPathFor("journal", dateKey)}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                >
                  Mở nhật ký <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          {/* Completion Ring */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="relative inline-flex items-center justify-center">
              <ProgressRing percent={completionPercent} size={88} stroke={7} color={ringColor} />
              <span className="absolute text-center">
                <span className="block text-xl font-bold text-white leading-none">
                  {completionPercent}
                </span>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  %
                </span>
              </span>
            </div>
            <div
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${dayStatusBg(dayStatus)} ${dayStatusColor(dayStatus)}`}
            >
              {dayStatusLabel(dayStatus)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Module Grid 2×2 ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Chọn khu vực để tiếp tục
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(MODULE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <Link
                key={key}
                to={dashboardPathFor(key, dateKey)}
                className={`group relative overflow-hidden rounded-2xl border bg-slate-800/40 p-4 shadow-sm ring-1 ring-inset ring-white/[0.04] transition-all duration-200 ${cfg.border} ${cfg.hoverBorder} hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:p-5`}
              >
                {/* Subtle corner glow on hover */}
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle, var(--tw-ring-color, currentColor) 0%, transparent 70%)`,
                  }}
                  aria-hidden="true"
                />

                <div className="relative flex items-start gap-4">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg} ${cfg.iconColor} transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="block font-bold text-white">{cfg.label}</span>
                    <span className="mt-0.5 block text-sm text-slate-400">{cfg.description}</span>
                    <span className={`mt-2 block truncate text-xs font-semibold ${cfg.statusColor}`}>
                      {moduleStatuses[key]}
                    </span>
                  </div>

                  <ArrowRight
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-slate-600 transition-all duration-200 ${cfg.arrowHover} group-hover:translate-x-0.5`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TodayDashboard;
