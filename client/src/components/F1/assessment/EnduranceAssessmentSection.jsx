// EnduranceAssessmentSection.jsx
import { useCallback } from "react";
import { Gauge, Timer, Zap } from "lucide-react";
import ExerciseTestCard from "./ExerciseTestCard";
import { pickSuggestion } from "../../../utils/assessmentExercises";

const EnduranceAssessmentSection = ({
  value,
  onChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const handleMuscularEnduranceChange = useCallback(
    (field, next) => onChange("muscularEndurance", field, next),
    [onChange],
  );

  const handleCoreEnduranceChange = useCallback(
    (field, next) => onChange("coreEndurance", field, next),
    [onChange],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-orange-200 pb-3">
        <Gauge size={20} className="text-orange-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Sức bền (Endurance)</h3>
          <p className="text-sm text-slate-500">
            Đánh giá sức bền cơ bắp và khả năng chịu tải.
          </p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <ExerciseTestCard
          title="Sức bền cơ bắp (Muscular Endurance)"
          icon={Zap}
          value={value.muscularEndurance}
          suggestion={pickSuggestion(suggestions, "muscularEndurance", 0)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleMuscularEnduranceChange}
        />
        <ExerciseTestCard
          title="Sức bền cơ lõi (Core Endurance)"
          icon={Timer}
          value={value.coreEndurance}
          suggestion={pickSuggestion(suggestions, "coreEndurance", 1)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCoreEnduranceChange}
        />
      </div>
    </div>
  );
};

export default EnduranceAssessmentSection;
