// CardioAssessmentSection.jsx
import { useCallback } from "react";
import { Heart, Activity } from "lucide-react";
import {
  computeCardioCapacityScore,
  computeRecoveryScore,
} from "../../../utils/assessment.helpers";
import ExerciseTestCard from "./ExerciseTestCard";
import { pickSuggestion } from "../../../utils/assessmentExercises";

const CardioAssessmentSection = ({
  value,
  onMetricChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const handleCardioCapacityChange = useCallback(
    (field, next) => onMetricChange("cardioCapacity", field, next),
    [onMetricChange],
  );

  const handleRecoveryHeartRateChange = useCallback(
    (field, next) => onMetricChange("recoveryHeartRate", field, next),
    [onMetricChange],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-orange-200 pb-3">
        <Activity size={20} className="text-orange-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Tim mạch (Cardio)</h3>
          <p className="text-sm text-slate-500">
            Nhịp tim nghỉ được lấy tự động từ khảo sát. Phần này chỉ đánh giá
            năng lực tim mạch và khả năng hồi phục.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ExerciseTestCard
          title="Năng lực tim mạch (Cardio Capacity)"
          icon={Heart}
          scoring="result"
          value={value.cardioCapacity}
          suggestion={pickSuggestion(suggestions, "cardioCapacity", 0)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCardioCapacityChange}
          resultLabel="Kết quả (phút)"
          resultPlaceholder="Ví dụ: 24"
          computeResultScore={computeCardioCapacityScore}
        />
        <ExerciseTestCard
          title="Hồi phục nhịp tim (Heart Rate Recovery)"
          icon={Heart}
          scoring="result"
          value={value.recoveryHeartRate}
          suggestion={pickSuggestion(suggestions, "recoveryHeartRate", 1)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleRecoveryHeartRateChange}
          resultLabel="Kết quả (nhịp tim giảm sau 1 phút)"
          resultPlaceholder="Ví dụ: 15"
          computeResultScore={computeRecoveryScore}
        />
      </div>
    </div>
  );
};

export default CardioAssessmentSection;
