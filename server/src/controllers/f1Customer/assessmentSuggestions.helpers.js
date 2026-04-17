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

const formatTieredTitle = ({ easy = [], standard = [], advanced = [] }) =>
  [
    easy.length ? `Mức dễ:\n- ${easy.join("\n- ")}` : "",
    standard.length ? `Mức tiêu chuẩn:\n- ${standard.join("\n- ")}` : "",
    advanced.length ? `Mức nâng cao:\n- ${advanced.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

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

  const upperPushTitle = formatTieredTitle({
    easy: ["Wall Push-Up", "Band Chest Press"],
    standard: ["Incline Push-Up", "Dumbbell Floor Press"],
    advanced: ["Knee Push-Up", "Seated Dumbbell Press nhẹ"],
  });

  const upperPullTitle = formatTieredTitle({
    easy: ["Band Row", "Seated Band Row"],
    standard: ["One Arm Dumbbell Row", "Chest Supported Dumbbell Row"],
    advanced: ["Bent Over Dumbbell Row nhẹ", "Face Pull"],
  });

  const lowerBodyTitle =
    goal === "fat_loss"
      ? formatTieredTitle({
          easy: ["Sit-To-Stand", "Box Squat"],
          standard: ["Bodyweight Squat", "Step-Up thấp"],
          advanced: ["Goblet Squat nhẹ", "Supported Split Squat"],
        })
      : formatTieredTitle({
          easy: ["Sit-To-Stand", "Box Squat"],
          standard: ["Bodyweight Squat", "Goblet Squat nhẹ"],
          advanced: ["Supported Split Squat", "DB Romanian Deadlift nhẹ"],
        });

  const coreStrengthTitle = formatTieredTitle({
    easy: ["Dead Bug", "Bird Dog"],
    standard: ["Incline Plank", "Pallof Press"],
    advanced: ["Front Plank", "Suitcase Hold"],
  });

  return [
    {
      title: upperPushTitle,
      target: "Upper Body Push Strength",
      reason:
        "Ưu tiên các bài đẩy bằng bodyweight, band và dumbbell để PT dễ quan sát, dễ chỉnh form và vẫn đủ đa dạng cho khách F1.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: upperPullTitle,
      target: "Upper Body Pull Strength",
      reason:
        "Các bài kéo bằng band hoặc dumbbell an toàn hơn, ít đòi hỏi setup phức tạp và phù hợp để test nền lực kéo thân trên.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: lowerBodyTitle,
      target: "Lower Body Strength",
      reason:
        goal === "fat_loss"
          ? "Nhóm bài squat, sit-to-stand và step-up giúp đánh giá nền lực thân dưới rõ, dễ dạy và phù hợp khách F1."
          : "Nhóm bài thân dưới bằng bodyweight hoặc dumbbell giúp test sức mạnh chân an toàn mà vẫn đủ đa dạng.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: coreStrengthTitle,
      target: "Core Strength",
      reason:
        "Ưu tiên các bài core dễ kiểm soát như dead bug, bird dog, plank và anti-rotation để PT quan sát brace, stability và control.",
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

  const muscularEnduranceTitle = beginnerLike
    ? formatTieredTitle({
        easy: ["March In Place", "Step Touch"],
        standard: ["Sit-To-Stand liên tục", "Wall Push-Up liên tục"],
        advanced: ["Step-Up liên tục", "Band Row reps cao"],
      })
    : formatTieredTitle({
        easy: ["March In Place", "Step Touch"],
        standard: ["Bodyweight Squat liên tục", "Incline Push-Up reps cao"],
        advanced: ["Step-Up liên tục", "Band Row reps cao"],
      });

  const coreEnduranceTitle = beginnerLike
    ? formatTieredTitle({
        easy: ["Dead Bug tempo", "Bird Dog hold"],
        standard: ["Incline Plank Hold", "Pallof Press hold"],
        advanced: ["Front Plank Hold", "Bear Hold"],
      })
    : formatTieredTitle({
        easy: ["Dead Bug tempo", "Bird Dog hold"],
        standard: ["Front Plank Hold", "Side Plank gối"],
        advanced: ["Pallof Press hold", "Bear Hold"],
      });

  return [
    {
      title: muscularEnduranceTitle,
      target: "Muscular Endurance (Sức bền cơ bắp)",
      reason:
        "Ưu tiên các bài lặp lại đơn giản bằng bodyweight, band hoặc nhịp vận động liên tục để test sức bền cơ mà không đòi hỏi kỹ thuật phức tạp.",
      dosage,
      source: "fallback_engine",
    },
    {
      title: coreEnduranceTitle,
      target: "Core Endurance (Sức bền core)",
      reason:
        "Các bài hold hoặc tempo chậm giúp PT đánh giá sức bền core rõ ràng, ít rủi ro và rất phù hợp với khách F1.",
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
