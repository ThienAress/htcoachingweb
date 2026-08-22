import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { WeeklyCheckinCard } from "../progress/WeeklyCheckinCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { HabitCard } from "./HabitCard";
import { WellnessCard } from "./WellnessCard";


const TodayJournal = () => {
  const { user } = useAuth();
  const { data, dateKey, handleJournalChanged } = useOutletContext();
  const journal = data.sections.journal.day;

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
      <div className="mb-4">
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
