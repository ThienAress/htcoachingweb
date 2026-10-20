import { CalendarDays } from "lucide-react";
import { WEEK_DAYS, getSplitLabel } from "../../../utils/f1StageDesign";

// Lịch tập mỗi tuần HLV đã đặt, hiện trên thẻ giai đoạn và trong báo cáo.
const F1WeeklyScheduleView = ({ schedule }) => {
  if (!schedule?.days?.length) return null;
  const sessions = schedule.sessionsPerWeek || schedule.days.filter(Boolean).length;
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
        <CalendarDays size={16} aria-hidden="true" />
        Lịch tập mỗi tuần
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {sessions} buổi/tuần
        {schedule.sessionMinutes ? ` · ${schedule.sessionMinutes} phút mỗi buổi` : ""}
        {getSplitLabel(schedule) ? ` · ${getSplitLabel(schedule)}` : ""}
      </p>
      <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {WEEK_DAYS.map((day, index) => {
          const on = Boolean(schedule.days[index]);
          return (
            <li
              key={day}
              className={`rounded-lg border px-2 py-2 text-center text-xs ${
                on ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <span className="block text-sm font-semibold">{day}</span>
              {on ? "Buổi tập" : "Nghỉ"}
            </li>
          );
        })}
      </ul>
      {schedule.note && <p className="mt-2 text-xs text-slate-500">{schedule.note}</p>}
    </div>
  );
};

export default F1WeeklyScheduleView;
