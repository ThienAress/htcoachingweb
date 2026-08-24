import { useEffect, useRef } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { WeeklyCheckinCard } from "../progress/WeeklyCheckinCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { HabitCard } from "./HabitCard";
import { WellnessCard } from "./WellnessCard";


const TodayJournal = () => {
  const { user } = useAuth();
  const location = useLocation();
  const weeklyReportRef = useRef(null);
  const { data, dateKey, handleJournalChanged } = useOutletContext();
  const journal = data.sections.journal.day;

  useEffect(() => {
    if (location.hash !== "#weekly-report") return undefined;
    const frame = window.requestAnimationFrame(() => {
      weeklyReportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      weeklyReportRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, dateKey]);

  return (
    <div>
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
      <div
        ref={weeklyReportRef}
        tabIndex={-1}
        className="mb-4 scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <WeeklyCheckinCard
          dateKey={dateKey}
          userId={user?._id}
        />
      </div>
      <ActivityTimeline dateKey={dateKey} enabled />
    </div>
  );
};

export default TodayJournal;
