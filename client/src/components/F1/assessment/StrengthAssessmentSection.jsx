// StrengthAssessmentSection.jsx
import { useCallback } from "react";
import { Dumbbell, Battery } from "lucide-react";
import ExerciseTestCard from "./ExerciseTestCard";
import { pickSuggestion } from "../../../utils/assessmentExercises";

const StrengthAssessmentSection = ({
  value,
  onChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const handleUpperBodyPushChange = useCallback(
    (field, next) => onChange("upperBodyPush", field, next),
    [onChange],
  );

  const handleUpperBodyPullChange = useCallback(
    (field, next) => onChange("upperBodyPull", field, next),
    [onChange],
  );

  const handleLowerBodyChange = useCallback(
    (field, next) => onChange("lowerBody", field, next),
    [onChange],
  );

  const handleCoreStrengthChange = useCallback(
    (field, next) => onChange("coreStrength", field, next),
    [onChange],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-orange-200 pb-3">
        <Battery size={20} className="text-orange-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Sức mạnh (Strength)</h3>
          <p className="text-sm text-slate-500">
            Đánh giá sức mạnh cơ bản theo từng nhóm chính.
          </p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <ExerciseTestCard
          title="Sức mạnh đẩy thân trên (Upper Push)"
          icon={Dumbbell}
          value={value.upperBodyPush}
          suggestion={pickSuggestion(suggestions, "upperBodyPush", 0)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleUpperBodyPushChange}
        />
        <ExerciseTestCard
          title="Sức mạnh kéo thân trên (Upper Pull)"
          icon={Dumbbell}
          value={value.upperBodyPull}
          suggestion={pickSuggestion(suggestions, "upperBodyPull", 1)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleUpperBodyPullChange}
        />
        <ExerciseTestCard
          title="Sức mạnh thân dưới (Lower Body)"
          icon={Dumbbell}
          value={value.lowerBody}
          suggestion={pickSuggestion(suggestions, "lowerBody", 2)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleLowerBodyChange}
        />
        <ExerciseTestCard
          title="Sức mạnh cơ lõi (Core)"
          icon={Dumbbell}
          value={value.coreStrength}
          suggestion={pickSuggestion(suggestions, "coreStrength", 3)}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCoreStrengthChange}
        />
      </div>
    </div>
  );
};

export default StrengthAssessmentSection;
