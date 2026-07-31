import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { WeeklyCheckinCard } from "../progress/WeeklyCheckinCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { CoachingCommentThread } from "./CoachingCommentThread";
import { HabitCard } from "./HabitCard";
import { WellnessCard } from "./WellnessCard";


const TodayJournal = () => {
  const { user } = useAuth();
  const { data, dateKey, handleJournalChanged } = useOutletContext();
  const journal = data.sections.journal.day;

  return (
    <div>
      <WellnessCard
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
      {journal?._id && (
        <div className="my-4">
          <CoachingCommentThread
            targetType="daily_journal"
            targetId={journal._id}
            title="Trao đổi về ngày này"
          />
        </div>
      )}
      <ActivityTimeline dateKey={dateKey} enabled />
    </div>
  );
};

export default TodayJournal;