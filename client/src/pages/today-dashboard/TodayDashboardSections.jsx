import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Dumbbell,
  History,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

const definitions = {
  schedule: {
    title: "Lịch tập",
    empty: "Không có lịch tập trong ngày này.",
    actionLabel: "Đăng ký giờ tập",
    icon: CalendarClock,
  },
  coaching: {
    title: "Coaching trong ngày",
    empty: "HLV chưa giao nội dung coaching cho ngày này.",
    actionLabel: "Mở giáo án online",
    icon: ClipboardCheck,
  },
  workout: {
    title: "Giáo án",
    empty: "Không có giáo án đã xuất bản trong ngày này.",
    actionLabel: "Xem giáo án tập luyện",
    icon: Dumbbell,
  },
  attendance: {
    title: "Điểm danh",
    empty: "Chưa có lượt điểm danh trong ngày này.",
    actionLabel: "Xem lịch sử check-in",
    icon: History,
  },
};

const StatusBadge = ({ status }) => {
  const label =
    status === "completed"
      ? "Hoàn thành"
      : status === "published"
        ? "Đã xuất bản"
        : "Đã lên lịch";
  return (
    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
      {label}
    </span>
  );
};

const ScheduleItems = ({ items }) => (
  <ul className="space-y-3">
    {items.map((item) => (
      <li
        key={item._id}
        className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 last:border-0 last:pb-0"
      >
        <div>
          <p className="font-semibold text-white">{item.exerciseType}</p>
          <p className="mt-1 text-sm text-slate-400">
            {item.startTime}–{item.endTime}
            {item.notes ? " · " + item.notes : ""}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </li>
    ))}
  </ul>
);

const CoachingDay = ({ day }) => (
  <div>
    <h3 className="font-semibold text-white">{day.title}</h3>
    {day.note && <p className="mt-1 text-sm text-slate-400">{day.note}</p>}
    <ul className="mt-4 space-y-2">
      {day.exercises.map((exercise, index) => (
        <li
          key={exercise.name + index}
          className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-900 px-3 py-2"
        >
          <span
            className={
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full " +
              (exercise.completed
                ? "bg-emerald-500 text-slate-950"
                : "border border-slate-600 text-transparent")
            }
            aria-label={exercise.completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
          >
            <Check size={15} aria-hidden="true" />
          </span>
          <span className="text-sm text-slate-200">
            {exercise.name} · {exercise.sets} hiệp × {exercise.reps}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const WorkoutItems = ({ items }) => (
  <ul className="space-y-3">
    {items.map((item) => (
      <li
        key={item._id}
        className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 last:border-0 last:pb-0"
      >
        <div>
          <Link
            to={item.deepLink}
            className="inline-flex min-h-11 items-center font-semibold text-white hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-sm text-slate-400">
            {item.sectionCount} phần · {item.exerciseCount} bài
          </p>
        </div>
        <StatusBadge status={item.status} />
      </li>
    ))}
  </ul>
);

const AttendanceItems = ({ items }) => (
  <ul className="space-y-3">
    {items.map((item) => (
      <li key={item._id} className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{item.muscle}</p>
          <p className="mt-1 text-sm text-slate-400">
            {new Intl.DateTimeFormat("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(item.time))}
          </p>
        </div>
        <span className="text-sm text-slate-400">
          Còn {item.remainingSessions} buổi
        </span>
      </li>
    ))}
  </ul>
);

const SectionContent = ({ name, section }) => {
  if (section.status === "empty") {
    return <p className="text-sm text-slate-400">{definitions[name].empty}</p>;
  }
  if (name === "schedule") return <ScheduleItems items={section.items} />;
  if (name === "coaching") return <CoachingDay day={section.day} />;
  if (name === "workout") return <WorkoutItems items={section.items} />;
  return <AttendanceItems items={section.items} />;
};

export const DashboardToolShortcut = ({
  to,
  icon: Icon,
  title,
  description,
  className = "",
}) => (
  <Link
    to={to}
    aria-label={title}
    className={
      "group flex min-h-20 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 transition-colors hover:border-slate-700 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
      className
    }
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-orange-300 group-hover:bg-slate-800">
      <Icon aria-hidden="true" className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-bold text-white">{title}</span>
      <span className="mt-1 block text-sm leading-5 text-slate-400">
        {description}
      </span>
    </span>
    <ArrowUpRight
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-orange-300"
    />
  </Link>
);

export const TodayDashboardSection = ({ name, section, onRetry }) => {
  const definition = definitions[name];
  const Icon = definition.icon;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <Icon size={19} className="text-orange-400" aria-hidden="true" />
          {definition.title}
        </h2>
        <Link
          to={section.deepLink}
          className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-orange-300 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          {definition.actionLabel}
        </Link>
      </div>
      {section.status === "error" ? (
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
          <p className="text-sm text-amber-100">{section.error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Thử lại
          </button>
        </div>
      ) : (
        <SectionContent name={name} section={section} />
      )}
    </section>
  );
};
