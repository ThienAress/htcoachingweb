const buildAssessmentStarterWarnings = ({ intake }) => {
  const warnings = [];
  const systemFlags = intake?.systemFlags || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const training = intake?.trainingProfileGoal || {};
  const bodyMetrics = intake?.bodyMetrics || {};

  if (systemFlags.testPermission === "hold_test") {
    warnings.push(
      "Khách đang ở trạng thái hoãn đánh giá, chỉ nên xem xét thêm trước khi cho test hoặc tập thử.",
    );
  }

  if (systemFlags.testPermission === "modified_test") {
    warnings.push(
      "Khách phù hợp với đánh giá có điều chỉnh, nên ưu tiên bài khởi đầu ổn định, tải thấp và dễ kiểm soát.",
    );
  }

  if (
    Number(lifestyle.sleepHours || 0) > 0 &&
    Number(lifestyle.sleepHours || 0) < 6
  ) {
    warnings.push(
      "Giấc ngủ đang thấp, nên giảm khối lượng tập đầu vào và tránh đẩy cường độ quá sớm.",
    );
  }

  if (lifestyle.stressLevel === "high") {
    warnings.push(
      "Căng thẳng cao, nên ưu tiên bài đơn giản, nhịp thở đều và thời gian nghỉ rõ ràng.",
    );
  }

  if (!training.currentlyTraining) {
    warnings.push(
      "Hiện tại khách chưa tập đều, nên ưu tiên bài nền tảng và dễ tuân thủ.",
    );
  }

  if (training.trainingExperience === "none") {
    warnings.push(
      "Khách chưa từng tập, mọi gợi ý nên ở mức an toàn cho người mới và dễ dạy kỹ thuật.",
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
      "Khách đang ưu tiên giảm mỡ, nên bài sức mạnh chọn theo hướng nền tảng, còn tim mạch ưu tiên bài ít va chạm, dễ duy trì.",
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
      "Khách đang ở trạng thái cần chú ý, nên gợi ý mang tính khởi đầu và hỗ trợ HLV ra quyết định, không thay thế đánh giá chuyên môn.",
    );
  }

  if (
    lifestyle.stressLevel === "high" ||
    Number(lifestyle.sleepHours || 0) < 6
  ) {
    rationale.push(
      "Khả năng hồi phục hiện chưa tối ưu, vì vậy gợi ý ưu tiên khối lượng tập vừa phải và bài có độ ổn định cao.",
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

const TIER_KEYS = ["easy", "standard", "advanced"];

const formatTieredTitle = ({ easy = [], standard = [], advanced = [] }) =>
  [
    easy.length ? `Mức dễ:\n- ${easy.join("\n- ")}` : "",
    standard.length ? `Mức tiêu chuẩn:\n- ${standard.join("\n- ")}` : "",
    advanced.length ? `Mức nâng cao:\n- ${advanced.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

// `key` giúp client ghép gợi ý đúng thẻ (không phụ thuộc thứ tự mảng).
// `tiers` là dữ liệu có cấu trúc; `title` giữ nguyên định dạng cũ để tương thích.
const buildTieredSuggestion = ({ key, target, reason, dosage, tiers }) => ({
  key,
  title: formatTieredTitle(tiers),
  tiers: Object.fromEntries(
    TIER_KEYS.map((tier) => [tier, [...(tiers[tier] || [])]]),
  ),
  target,
  reason,
  dosage,
  source: "fallback_engine",
});

const isBeginnerLike = (training = {}) =>
  !training.currentlyTraining ||
  training.trainingExperience === "none" ||
  training.trainingExperience === "beginner" ||
  Boolean(training.breakDuration);

const buildFallbackStrengthSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const goal = training.primaryGoal || "";
  const beginnerLike = isBeginnerLike(training);
  const lowRecovery =
    intake?.lifestyleNutrition?.stressLevel === "high" ||
    Number(intake?.lifestyleNutrition?.sleepHours || 0) < 6;

  const dosage = buildStarterDosage({ beginnerLike, lowRecovery });

  return [
    buildTieredSuggestion({
      key: "upperBodyPush",
      target: "Sức mạnh đẩy thân trên (Upper Push)",
      reason:
        "Ưu tiên các bài đẩy bằng trọng lượng cơ thể, dây kháng lực và tạ đơn để HLV dễ quan sát, dễ chỉnh form và vẫn đủ đa dạng cho khách F1.",
      dosage,
      tiers: {
        easy: [
          "Wall Push-Up",
          "Band Chest Press",
          "Machine Chest Press",
          "Counter Push-Up",
        ],
        standard: [
          "Incline Push-Up",
          "Dumbbell Floor Press",
          "Dumbbell Bench Press",
          "Standing Cable Press",
        ],
        advanced: [
          "Knee Push-Up",
          "Light Seated Dumbbell Press",
          "Full Push-Up",
          "Standing Dumbbell Shoulder Press",
        ],
      },
    }),
    buildTieredSuggestion({
      key: "upperBodyPull",
      target: "Sức mạnh kéo thân trên (Upper Pull)",
      reason:
        "Các bài kéo bằng dây kháng lực, cáp hoặc tạ đơn an toàn hơn, ít đòi hỏi setup phức tạp và phù hợp để kiểm tra nền lực kéo thân trên.",
      dosage,
      tiers: {
        easy: [
          "Band Row",
          "Seated Band Row",
          "Light Lat Pulldown",
          "Seated Cable Row",
        ],
        standard: [
          "One Arm Dumbbell Row",
          "Chest Supported Dumbbell Row",
          "Lat Pulldown",
          "Incline Dumbbell Row",
        ],
        advanced: [
          "Light Bent-Over Dumbbell Row",
          "Face Pull",
          "Assisted Pull-Up",
          "Light Barbell Bent-Over Row",
        ],
      },
    }),
    buildTieredSuggestion({
      key: "lowerBody",
      target: "Sức mạnh thân dưới (Lower Body)",
      reason:
        goal === "fat_loss"
          ? "Nhóm bài squat, đứng lên ngồi xuống và bước lên bục giúp đánh giá nền lực thân dưới rõ, dễ dạy và phù hợp khách F1."
          : "Nhóm bài thân dưới bằng trọng lượng cơ thể hoặc tạ đơn giúp kiểm tra sức mạnh chân an toàn mà vẫn đủ đa dạng.",
      dosage,
      tiers: {
        easy: [
          "Sit-To-Stand",
          "Box Squat",
          "Light Leg Press",
          "Glute Bridge",
        ],
        standard: [
          "Bodyweight Squat",
          "Low Step-Up",
          "Light Goblet Squat",
          "Light Dumbbell RDL",
        ],
        advanced: [
          "Supported Split Squat",
          "Split Squat",
          "High Step-Up",
        ],
      },
    }),
    buildTieredSuggestion({
      key: "coreStrength",
      target: "Sức mạnh cơ lõi (Core)",
      reason:
        "Ưu tiên các bài cơ lõi dễ kiểm soát như bọ chết, chó chim, plank và chống xoay để HLV quan sát được khả năng siết lõi, giữ ổn định và kiểm soát.",
      dosage,
      tiers: {
        easy: [
          "Dead Bug",
          "Bird Dog",
          "Glute Bridge Hold",
          "Crunch",
        ],
        standard: [
          "Incline Plank",
          "Pallof Press",
          "Cable Chop",
        ],
        advanced: [
          "Front Plank",
          "Suitcase Hold",
          "Shoulder-Tap Plank",
          "Russian Twist",
        ],
      },
    }),
  ];
};

const buildFallbackEnduranceSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const beginnerLike = isBeginnerLike(training);
  const lowRecovery =
    lifestyle.stressLevel === "high" || Number(lifestyle.sleepHours || 0) < 6;

  const dosage = buildStarterDosage({ beginnerLike, lowRecovery });

  const muscularEnduranceTiers = {
    easy: [
      "March In Place",
      "Step Touch",
      "30s Sit-To-Stand",
      "Light High Knees",
    ],
    standard: beginnerLike
      ? [
          "Continuous Sit-To-Stand",
          "Continuous Wall Push-Up",
          "60s Bodyweight Squat",
        ]
      : [
          "Continuous Bodyweight Squat",
          "High-Rep Incline Push-Up",
          "60s Incline Push-Up",
        ],
    advanced: [
      "Continuous Step-Up",
      "High-Rep Band Row",
      "2-Min High Step-Up",
      "2-Min Rowing",
    ],
  };

  const coreEnduranceTiers = {
    easy: [
      "Tempo Dead Bug",
      "Bird Dog Hold",
      "Knee Plank Hold",
    ],
    standard: beginnerLike
      ? [
          "Incline Plank Hold",
          "Pallof Press Hold",
          "Front Plank Hold",
        ]
      : [
          "Front Plank Hold",
          "Knee Side Plank",
          "Incline Plank Hold",
        ],
    advanced: beginnerLike
      ? [
          "Front Plank Hold",
          "Bear Hold",
          "Side Plank",
        ]
      : [
          "Pallof Press Hold",
          "Bear Hold",
          "Side Plank",
          "Hollow Hold",
        ],
  };

  return [
    buildTieredSuggestion({
      key: "muscularEndurance",
      target: "Sức bền cơ bắp (Muscular Endurance)",
      reason:
        "Ưu tiên các bài lặp lại đơn giản bằng trọng lượng cơ thể, dây kháng lực hoặc nhịp vận động liên tục để kiểm tra sức bền cơ mà không đòi hỏi kỹ thuật phức tạp.",
      dosage,
      tiers: muscularEnduranceTiers,
    }),
    buildTieredSuggestion({
      key: "coreEndurance",
      target: "Sức bền cơ lõi (Core Endurance)",
      reason:
        "Các bài giữ tư thế hoặc nhịp chậm giúp HLV đánh giá sức bền cơ lõi rõ ràng, ít rủi ro và rất phù hợp với khách F1.",
      dosage,
      tiers: coreEnduranceTiers,
    }),
  ];
};

const buildFallbackCardioSuggestions = ({ intake }) => {
  const training = intake?.trainingProfileGoal || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const restingHeartRate = Number(intake?.bodyMetrics?.restingHeartRate || 0);

  const beginnerLike = isBeginnerLike(training);
  const lowRecovery =
    lifestyle.stressLevel === "high" ||
    Number(lifestyle.sleepHours || 0) < 6 ||
    restingHeartRate >= 85;

  const capacityDosage = buildStarterDosage({
    beginnerLike,
    lowRecovery,
    cardio: true,
  });

  return [
    buildTieredSuggestion({
      key: "cardioCapacity",
      target: "Năng lực tim mạch (Cardio Capacity)",
      reason:
        "Chọn bài ít va chạm, dễ kiểm soát tốc độ; ghi lại số phút khách duy trì được ở cường độ phù hợp để xây nền tim mạch ban đầu.",
      dosage: capacityDosage,
      tiers: {
        easy: [
          "Treadmill Walk",
          "Light Stationary Bike",
          "Outdoor Walk",
        ],
        standard: [
          "Incline Walk",
          "Elliptical",
          "Moderate Stationary Bike",
        ],
        advanced: [
          "Jog-Walk",
          "Rowing",
          "Intense Stationary Bike",
        ],
      },
    }),
    buildTieredSuggestion({
      key: "recoveryHeartRate",
      target: "Hồi phục nhịp tim (Heart Rate Recovery)",
      reason:
        "Đo nhịp tim ngay khi kết thúc bài test và sau 1 phút nghỉ; mức nhịp tim giảm càng lớn thì khả năng hồi phục càng tốt.",
      dosage: "Ghi nhịp tim lúc kết thúc và sau 1 phút nghỉ, nhập mức giảm (nhịp/phút)",
      tiers: {
        easy: ["3-Min Brisk Walk"],
        standard: ["3-Min Step Test"],
        advanced: ["3-Min Bike Test"],
      },
    }),
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
