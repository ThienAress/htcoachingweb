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
          "Hít đất tường (Wall Push-Up)",
          "Đẩy ngực dây kháng lực (Band Chest Press)",
          "Đẩy ngực máy nhẹ (Machine Chest Press)",
          "Hít đất bàn/quầy (Counter Push-Up)",
        ],
        standard: [
          "Hít đất nghiêng (Incline Push-Up)",
          "Đẩy ngực tạ đơn nằm sàn (Dumbbell Floor Press)",
          "Đẩy ngực tạ đơn nằm ghế (Dumbbell Bench Press)",
          "Đẩy ngực cáp đứng (Standing Cable Press)",
        ],
        advanced: [
          "Hít đất quỳ gối (Knee Push-Up)",
          "Đẩy vai tạ đơn ngồi nhẹ (Seated Dumbbell Press nhẹ)",
          "Hít đất chuẩn (Full Push-Up)",
          "Đẩy vai tạ đơn đứng (Standing Dumbbell Shoulder Press)",
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
          "Kéo dây kháng lực (Band Row)",
          "Kéo dây kháng lực ngồi (Seated Band Row)",
          "Kéo xô máy nhẹ (Lat Pulldown nhẹ)",
          "Kéo cáp ngồi (Seated Cable Row)",
        ],
        standard: [
          "Kéo tạ đơn một tay (One Arm Dumbbell Row)",
          "Kéo tạ đơn tựa ngực (Chest Supported Dumbbell Row)",
          "Kéo xô cáp (Lat Pulldown)",
          "Kéo tạ đơn trên ghế dốc (Incline Dumbbell Row)",
        ],
        advanced: [
          "Kéo tạ đơn cúi người nhẹ (Bent Over Dumbbell Row nhẹ)",
          "Kéo cáp về mặt (Face Pull)",
          "Kéo xà có hỗ trợ (Assisted Pull-Up)",
          "Kéo tạ đòn cúi người nhẹ (Barbell Bent-Over Row nhẹ)",
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
          "Đứng lên ngồi xuống (Sit-To-Stand)",
          "Squat ngồi hộp (Box Squat)",
          "Đạp đùi máy nhẹ (Leg Press nhẹ)",
          "Cầu mông (Glute Bridge)",
        ],
        standard: [
          "Squat trọng lượng cơ thể (Bodyweight Squat)",
          "Bước lên bục thấp (Step-Up thấp)",
          "Squat cốc nhẹ (Goblet Squat nhẹ)",
          "Gập hông tạ đơn nhẹ (Dumbbell RDL nhẹ)",
        ],
        advanced: [
          "Chùng chân có tựa (Supported Split Squat)",
          "Chùng chân tại chỗ (Split Squat)",
          "Bước lên bục cao (High Step-Up)",
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
          "Bọ chết (Dead Bug)",
          "Chó chim (Bird Dog)",
          "Cầu mông giữ (Glute Bridge Hold)",
          "Gập bụng ngắn (Crunch)",
        ],
        standard: [
          "Plank nghiêng (Incline Plank)",
          "Đẩy dây kháng lực chống xoay (Pallof Press)",
          "Chặt gỗ cáp (Cable Chop)",
        ],
        advanced: [
          "Plank chuẩn (Front Plank)",
          "Xách tạ một bên (Suitcase Hold)",
          "Plank chạm vai (Shoulder-Tap Plank)",
          "Xoay Nga (Russian Twist)",
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
      "Đi tại chỗ (March In Place)",
      "Bước ngang chạm chân (Step Touch)",
      "Đứng lên ngồi xuống 30 giây (30s Sit-To-Stand)",
      "Nâng gối tại chỗ nhẹ (High Knees nhẹ)",
    ],
    standard: beginnerLike
      ? [
          "Đứng lên ngồi xuống liên tục (Sit-To-Stand liên tục)",
          "Hít đất tường liên tục (Wall Push-Up liên tục)",
          "Squat trọng lượng cơ thể 60 giây (Bodyweight Squat 60s)",
        ]
      : [
          "Squat trọng lượng cơ thể liên tục (Bodyweight Squat liên tục)",
          "Hít đất nghiêng nhiều reps (Incline Push-Up reps cao)",
          "Hít đất nghiêng 60 giây (Incline Push-Up 60s)",
        ],
    advanced: [
      "Bước lên bục liên tục (Step-Up liên tục)",
      "Kéo dây kháng lực nhiều reps (Band Row reps cao)",
      "Bước lên bục cao 2 phút (High Step-Up 2 phút)",
      "Chèo thuyền máy 2 phút (Rowing 2 phút)",
    ],
  };

  const coreEnduranceTiers = {
    easy: [
      "Bọ chết nhịp chậm (Dead Bug tempo)",
      "Chó chim giữ (Bird Dog hold)",
      "Plank quỳ gối (Knee Plank Hold)",
    ],
    standard: beginnerLike
      ? [
          "Plank nghiêng giữ (Incline Plank Hold)",
          "Giữ đẩy dây chống xoay (Pallof Press hold)",
          "Plank khuỷu tay (Front Plank Hold)",
        ]
      : [
          "Plank khuỷu tay (Front Plank Hold)",
          "Plank nghiêng bên quỳ gối (Side Plank gối)",
          "Plank nghiêng giữ (Incline Plank Hold)",
        ],
    advanced: beginnerLike
      ? [
          "Plank khuỷu tay giữ lâu (Front Plank Hold)",
          "Giữ tư thế gấu (Bear Hold)",
          "Plank nghiêng bên (Side Plank)",
        ]
      : [
          "Giữ đẩy dây chống xoay (Pallof Press hold)",
          "Giữ tư thế gấu (Bear Hold)",
          "Plank nghiêng bên (Side Plank)",
          "Giữ chữ V (Hollow Hold)",
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
          "Đi bộ máy chạy (Treadmill Walk)",
          "Xe đạp tại chỗ cường độ nhẹ (Stationary Bike nhẹ)",
          "Đi bộ ngoài trời 20 phút (Outdoor Walk)",
        ],
        standard: [
          "Đi bộ máy chạy có độ dốc nhẹ (Incline Walk)",
          "Máy elip (Elliptical)",
          "Xe đạp cường độ vừa (Stationary Bike vừa)",
        ],
        advanced: [
          "Chạy bộ nhẹ xen đi bộ (Jog–Walk)",
          "Chèo thuyền máy (Rowing)",
          "Xe đạp cường độ cao (Stationary Bike cao)",
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
        easy: ["Đi bộ nhanh 3 phút (3-Min Brisk Walk)"],
        standard: ["Bước lên bục 3 phút (3-Min Step Test)"],
        advanced: ["Đạp xe cường độ cao 3 phút (3-Min Bike Test)"],
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
