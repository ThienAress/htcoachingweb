import { CalendarDays, CalendarRange } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { WeeklyCheckinCard } from "../progress/WeeklyCheckinCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { HabitCard } from "./HabitCard";
import { WellnessCard } from "./WellnessCard";


const TodayJournal = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const weeklyReportRef = useRef(null);
  const [selectedReport, setSelectedReport] = useState(() =>
    location.hash === "#weekly-report" ? "weekly" : "daily",
  );
  const activeReport =
    location.hash === "#weekly-report" ? "weekly" : selectedReport;
  const { data, dateKey, handleJournalChanged } = useOutletContext();
  const journal = data.sections.journal.day;

  useEffect(() => {
    if (location.hash !== "#weekly-report" || activeReport !== "weekly") {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      weeklyReportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      weeklyReportRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeReport, location.hash, dateKey]);

  const selectReport = (report) => {
    setSelectedReport(report);
    if (location.hash === "#weekly-report" && report !== "weekly") {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: "",
        },
        { replace: true },
      );
    }
  };

  return (
    <div className="space-y-5">
      <nav
        className="rounded-2xl border border-slate-800 bg-slate-950 p-2"
        aria-label="Loại nhật ký báo cáo"
      >
        <div className="grid gap-2 sm:grid-cols-2" role="tablist">
          {[
            {
              id: "daily",
              label: "Nhật ký báo cáo ngày",
              description: "Sức khỏe, thói quen và hoạt động trong ngày",
              icon: CalendarDays,
            },
            {
              id: "weekly",
              label: "Nhật ký báo cáo tuần",
              description: "Các số đo cơ thể theo từng kỳ trong tháng",
              icon: CalendarRange,
            },
          ].map((item) => {
            const Icon = item.icon;
            const selected = activeReport === item.id;
            return (
              <button
                key={item.id}
                id={`journal-${item.id}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`journal-${item.id}-panel`}
                onClick={() => selectReport(item.id)}
                className={
                  selected
                    ? "flex min-h-20 items-center gap-3 rounded-xl border border-orange-400 bg-orange-400/10 px-4 py-3 text-left text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                    : "flex min-h-20 items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                }
              >
                <span
                  className={
                    selected
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-400 text-slate-950"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
                  }
                >
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {activeReport === "daily" && (
        <div
          id="journal-daily-panel"
          role="tabpanel"
          aria-labelledby="journal-daily-tab"
          className="space-y-4"
        >
          <WellnessCard
            key={`${dateKey}:${journal?._id || "new"}:${journal?.revision || 0}`}
            dateKey={dateKey}
            journal={journal}
            canEdit={data.capabilities.canEditJournal}
            onChanged={handleJournalChanged}
          />
          <HabitCard
            dateKey={dateKey}
            journal={journal}
            canEdit={data.capabilities.canEditJournal}
            onChanged={handleJournalChanged}
          />
          <ActivityTimeline dateKey={dateKey} enabled />
        </div>
      )}

      {activeReport === "weekly" && (
        <div
          id="journal-weekly-panel"
          ref={weeklyReportRef}
          role="tabpanel"
          aria-labelledby="journal-weekly-tab"
          tabIndex={-1}
          className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <WeeklyCheckinCard dateKey={dateKey} userId={user?._id} />
        </div>
      )}
    </div>
  );
};

export default TodayJournal;
