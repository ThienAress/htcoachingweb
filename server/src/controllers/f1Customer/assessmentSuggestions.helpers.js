const buildAssessmentStarterWarnings = ({ intake }) => {
  const warnings = [];
  const systemFlags = intake?.systemFlags || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const training = intake?.trainingProfileGoal || {};
  const bodyMetrics = intake?.bodyMetrics || {};

  if (systemFlags.testPermission === "hold_test") {
    warnings.push(
      "Khách đang ở trạng thái HOLD TEST, chỉ nên review thêm trước khi cho test hoặc tập thử.",
    );
  }

  if (systemFlags.testPermission === "modified_test") {
    warnings.push(
      "Khách phù hợp với modified test, nên ưu tiên bài khởi đầu ổn định, tải thấp và dễ kiểm soát.",
    );
  }

  if (
    Number(lifestyle.sleepHours || 0) > 0 &&
    Number(lifestyle.sleepHours || 0) < 6
  ) {
    warnings.push(
      "Giấc ngủ đang thấp, nên giảm volume đầu vào và tránh đẩy cường độ quá sớm.",
    );
  }

  if (lifestyle.stressLevel === "high") {
    warnings.push(
      "Stress cao, nên ưu tiên bài đơn giản, nhịp thở đều và thời gian nghỉ rõ ràng.",
    );
  }

  if (!training.currentlyTraining) {
    warnings.push(
      "Hiện tại khách chưa tập đều, nên ưu tiên bài nền tảng và dễ tuân thủ.",
    );
  }

  if (training.trainingExperience === "none") {
    warnings.push(
      "Khách chưa từng tập, mọi gợi ý nên ở mức beginner-safe và dễ dạy kỹ thuật.",
    );
  }

  if (Number(bodyMetrics.restingHeartRate || 0) >= 85) {
    warnings.push(
      "Nhịp tim nghỉ tương đối cao, nên bắt đầu cardio cường độ thấp đến vừa.",
    );
  }

  return warnings;
};

const buildAssessmentStarterRationale = ({ intake, customer }) => {
  const rationale = [];
  const goal = intake?.trainingProfileGoal?.primaryGoal || "";
  const training = intake?.trainingProfileGoal || {};
  const lifestyle = intake?.lifestyleNutrition || {};

  if (goal === "fat_loss") {
    rationale.push(
      "Khách đang ưu tiên giảm mỡ, nên bài sức mạnh chọn theo hướng nền tảng, còn tim mạch ưu tiên low-impact dễ duy trì.",
    );
  }

  if (goal === "muscle_gain" || goal === "weight_gain") {
    rationale.push(
      "Khách đang ưu tiên tăng cơ / tăng cân, nên phần sức mạnh vẫn đi từ bài cơ bản, ổn định và dễ tiến triển.",
    );
  }

  if (!training.currentlyTraining || training.trainingExperience === "none") {
    rationale.push(
      "Khách đang ở nền vận động thấp, nên gợi ý tập trung vào bài dễ học, dễ kiểm soát form và ít gây quá tải sớm.",
    );
  }

  if (customer?.readinessStatus === "caution") {
    rationale.push(
      "Khách đang ở trạng thái caution, nên gợi ý mang tính khởi đầu và hỗ trợ PT ra quyết định, không thay thế đánh giá chuyên môn.",
    );
  }

  if (
    lifestyle.stressLevel === "high" ||
    Number(lifestyle.sleepHours || 0) < 6
  ) {
    rationale.push(
      "Recovery hiện chưa tối ưu, vì vậy gợi ý ưu tiên volume vừa phải và bài có độ ổn định cao.",
    );
  }

  return rationale;
};

const buildStarterDosage = ({ beginnerLike, lowRecovery, cardio = false }) => {
  if (cardio) {
    return "20-30 phút, tăng dần theo từng tuần";
  }

  if (lowRecovery) {
    return "2-3 hiệp x 8-10 reps hoặc 2-3 hiệp x 20-30 giây";
  }

  if (beginnerLike) {
    return "2-3 hiệp x 8-10 reps hoặc 2-3 hiệp x 20-30 giây";
  }

  return "2-3 hiệp x 8-10 reps hoặc 2-3 hiệp x 20-30 giây";
};

const parseRange = (value) => {
  if (!value) return { min: null, max: null };

  const [min, max] = String(value)
    .split("-")
    .map((item) => Number(item));

  if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  if (Number.isFinite(min)) return { min, max: min };

  return { min: null, max: null };
};

const extractProtocolOptions = (dosage = "") => {
  const text = String(dosage || "");
  const options = [];

  const repsMatch = text.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*reps/i,
  );
  if (repsMatch) {
    const sets = parseRange(repsMatch[1]);
    const values = parseRange(repsMatch[2]);

    options.push({
      label: `${repsMatch[1]} hiệp × ${repsMatch[2]} reps`,
      mode: "reps",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: values.min,
      valueMax: values.max,
      unit: "reps",
    });
  }

  const timeMatch = text.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|vòng|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*(?:giây|s)\b/i,
  );
  if (timeMatch) {
    const sets = parseRange(timeMatch[1]);
    const values = parseRange(timeMatch[2]);

    options.push({
      label: `${timeMatch[1]} hiệp × ${timeMatch[2]} giây`,
      mode: "time",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: values.min,
      valueMax: values.max,
      unit: "seconds",
    });
  }

  return options;
};

const attachProtocolOptions = (items = []) =>
  items.map((item) => ({
    ...item,
    protocolOptions: extractProtocolOptions(item?.dosage),
  }));

const buildFallbackStrengthSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const goal = training.primaryGoal || "";

  const beginnerLike =
    !training.currentlyTraining ||
    training.trainingExperience === "none" ||
    training.trainingExperience === "beginner" ||
    Boolean(training.breakDuration);

  const lowRecovery =
    intake?.lifestyleNutrition?.stressLevel === "high" ||
    Number(intake?.lifestyleNutrition?.sleepHours || 0) < 6;

  const dosage = buildStarterDosage({ beginnerLike, lowRecovery });

  const upperPushTitle = beginnerLike
    ? "Wall Push-Up / Incline Push-Up"
    : "Incline Push-Up / Chest Press máy nhẹ";

  const pullTitle = beginnerLike
    ? "Band Row / Seated Row nhẹ"
    : "Seated Row / Cable Row nhẹ";

  const lowerBodyTitle =
    goal === "fat_loss"
      ? "Sit-To-Stand / Box Squat cơ bản"
      : "Box Squat / Goblet Squat rất nhẹ";

  return [
    {
      title: upperPushTitle,
      target: "Upper body push cơ bản",
      reason:
        "Phù hợp cho khách mới hoặc nền thấp, dễ học kỹ thuật đẩy và kiểm soát thân người tốt hơn các bài vai khó.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: lowerBodyTitle,
      target: "Lower body foundation",
      reason:
        goal === "fat_loss"
          ? "Giúp tạo nền lực chân và pattern squat cơ bản trước khi tăng khối lượng vận động."
          : "Giúp xây nền sức mạnh chân an toàn, dễ theo dõi kỹ thuật cho khách F1.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: pullTitle,
      target: "Upper body pull cơ bản",
      reason:
        "An toàn và dễ coaching hơn các bài kéo phức tạp, phù hợp để xây nền lưng - tay sau intake ban đầu.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: "Glute Bridge / Dead Bug",
      target: "Core + kiểm soát thân người",
      reason:
        "Giúp khách mới học cách siết core, ổn định thân người và hỗ trợ các bài chính phía sau.",
      dosage,
      source: "fallback_engine",
    },
  ];
};

const buildFallbackEnduranceSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const lifestyle = intake?.lifestyleNutrition || {};

  const beginnerLike =
    !training.currentlyTraining ||
    training.trainingExperience === "none" ||
    training.trainingExperience === "beginner" ||
    Boolean(training.breakDuration);

  const lowRecovery =
    lifestyle.stressLevel === "high" || Number(lifestyle.sleepHours || 0) < 6;

  const dosage = buildStarterDosage({ beginnerLike, lowRecovery });

  return [
    {
      title: "March In Place / Step Touch",
      target: "General endurance khởi đầu",
      reason:
        "Rất dễ tiếp cận cho khách mới, giúp làm quen nhịp vận động liên tục mà không quá tải.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: "Low Step-Up / Sit-To-Stand liên tục",
      target: "Lower body endurance",
      reason:
        "Giúp nâng nền sức bền chân bằng bài đơn giản, an toàn và sát thực tế cho khách F1.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: "Wall Sit ngắn / Plank trên ghế",
      target: "Core - isometric endurance",
      reason:
        "Tăng sức bền cơ bản mà vẫn dễ chỉnh level theo thể trạng và mức tự tin của khách.",
      dosage,
      source: "fallback_engine",
    },
  ];
};

const buildFallbackCardioSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const goal = training.primaryGoal || "";
  const restingHeartRate = Number(intake?.bodyMetrics?.restingHeartRate || 0);

  const beginnerLike =
    !training.currentlyTraining ||
    training.trainingExperience === "none" ||
    training.trainingExperience === "beginner" ||
    Boolean(training.breakDuration);

  const lowRecovery =
    lifestyle.stressLevel === "high" ||
    Number(lifestyle.sleepHours || 0) < 6 ||
    restingHeartRate >= 85;

  const treadmillTitle =
    goal === "fat_loss"
      ? "Treadmill Walk / Incline Walk nhẹ"
      : "Treadmill Walk pace vừa";

  const cardioDosage = buildStarterDosage({
    beginnerLike,
    lowRecovery,
    cardio: true,
  });

  return [
    {
      title: treadmillTitle,
      target: "Cardio nền low-impact",
      reason:
        "Dễ kiểm soát tốc độ, an toàn cho khách mới và rất phù hợp để xây nền tim mạch ban đầu.",
      dosage: cardioDosage,
      source: "fallback_engine",
    },
    {
      title: "Xe đạp tại chỗ cường độ thấp - vừa",
      target: "Cardio nền an toàn",
      reason:
        "Ít va chạm, phù hợp cho khách mới hoặc hôm recovery chưa tốt, dễ duy trì ở buổi đầu.",
      dosage: cardioDosage,
      source: "fallback_engine",
    },
  ];
};

export const buildAssessmentStarterSuggestions = async ({
  intake,
  customer,
}) => {
  const warnings = buildAssessmentStarterWarnings({ intake });
  const rationale = buildAssessmentStarterRationale({ intake, customer });

  return {
    warnings,
    rationale,
    sections: {
      strength: attachProtocolOptions(
        buildFallbackStrengthSuggestions({ intake }),
      ),
      endurance: attachProtocolOptions(
        buildFallbackEnduranceSuggestions({ intake }),
      ),
      cardio: buildFallbackCardioSuggestions({ intake }),
    },
  };
};
