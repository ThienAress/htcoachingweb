import { Calculator } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { NutritionCard } from "./NutritionCard";
import { DashboardToolShortcut } from "./TodayDashboardSections";

const TodayNutrition = () => {
  const { data, dateKey, handleJournalChanged } = useOutletContext();
  return (
    <div>
      <DashboardToolShortcut
        to="/tdee-calculator"
        icon={Calculator}
        title="Tính TDEE và tạo thực đơn"
        description="Tính nhu cầu năng lượng và tạo thực đơn phù hợp với mục tiêu của bạn."
        className="mb-4"
      />
      <NutritionCard
        dateKey={dateKey}
        journal={data.sections.journal.day}
        canEdit={data.capabilities.canEditJournal}
        onChanged={handleJournalChanged}
      />
    </div>
  );
};

export default TodayNutrition;
