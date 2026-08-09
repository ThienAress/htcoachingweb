import { LibraryBig } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import {
  DashboardToolShortcut,
  TodayDashboardSection,
} from "./TodayDashboardSections";

const SECTION_NAMES = ["schedule", "coaching", "workout", "attendance"];

const TodayTraining = () => {
  const { data, refetch } = useOutletContext();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SECTION_NAMES.map((name) => (
        <TodayDashboardSection
          key={name}
          name={name}
          section={data.sections[name]}
          onRetry={refetch}
        />
      ))}
      <DashboardToolShortcut
        to="/exercises"
        icon={LibraryBig}
        title="Hệ thống bài tập"
        description="Tra cứu kỹ thuật, nhóm cơ và hướng dẫn cho từng bài tập."
        className="md:col-span-2"
      />
    </div>
  );
};

export default TodayTraining;
