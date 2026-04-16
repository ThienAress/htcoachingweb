const PHASE_IMAGE_PROFILE = {
  phase_1: {
    phaseLabel: "Phase 1 - Stabilization Endurance",
    intensity: "subtle",
    bodyChange:
      "a subtle and believable improvement in posture, body alignment, overall balance, and a slightly cleaner body line",
    frontFocus:
      "a slightly more balanced shoulder line, a cleaner waist line, and a more stable overall standing posture",
    sideFocus:
      "a more upright posture, a slightly cleaner abdominal line, and a more stable side-body silhouette",
  },
  phase_2: {
    phaseLabel: "Phase 2 - Strength Endurance",
    intensity: "moderate",
    bodyChange:
      "a moderate and believable improvement in muscular firmness, body balance, and a stronger overall silhouette",
    frontFocus:
      "a firmer upper body, a stronger shoulder-to-waist proportion, and a more athletic front-facing body line",
    sideFocus:
      "a stronger torso profile, a firmer body line, and a more stable upright silhouette from the side",
  },
  phase_3: {
    phaseLabel: "Phase 3 - Hypertrophy",
    intensity: "moderate_to_clear",
    bodyChange:
      "a realistic increase in muscle fullness, more visible muscular shape, and a fuller yet natural physique",
    frontFocus:
      "a fuller upper body, more visible muscular fullness, and a clearer front-facing body shape while staying realistic",
    sideFocus:
      "a fuller torso and lower body profile, more muscular shape, and a stronger natural side silhouette",
  },
  phase_4: {
    phaseLabel: "Phase 4 - Maximal Strength",
    intensity: "moderate_to_clear",
    bodyChange:
      "a stronger and denser physique with realistic muscular firmness, better posture, and a more powerful silhouette",
    frontFocus:
      "a denser and stronger-looking upper body with a more powerful but still realistic front-facing shape",
    sideFocus:
      "a denser and stronger torso line with a more powerful but still believable side profile",
  },
  phase_5: {
    phaseLabel: "Phase 5 - Power",
    intensity: "athletic",
    bodyChange:
      "a more athletic, explosive, and refined physique with realistic muscular sharpness and efficient body balance",
    frontFocus:
      "a sharper, athletic, and powerful-looking front-facing physique with realistic definition",
    sideFocus:
      "a sharper and more athletic side profile with improved posture and efficient body balance",
  },
};

const GOAL_PROMPT_HINTS = {
  fat_loss:
    "The transformation should lean toward a leaner and tighter appearance, with a smaller waistline and cleaner body composition, while remaining realistic.",
  weight_gain:
    "The transformation should lean toward healthy weight gain and a fuller overall body shape, while remaining realistic and proportional.",
  muscle_gain:
    "The transformation should lean toward muscular development, fuller musculature, and a more athletic physique, while remaining realistic.",
  maintenance:
    "The transformation should lean toward better posture, better body balance, and a slightly improved athletic appearance without extreme changes.",
};

const GENDER_HINTS = {
  male: "Keep the body proportions realistic for an adult male.",
  female:
    "Keep the body proportions realistic for an adult female and preserve a natural, believable physique.",
  other: "Keep the body proportions natural, realistic, and believable.",
};

const LEVEL_HINTS = {
  low: "Do not make the transformation too aggressive. Keep it subtle and beginner-realistic.",
  below_average:
    "Keep the transformation moderate and believable for a person building up from a lower fitness base.",
  average:
    "Keep the transformation realistic and moderate for a person with an average starting condition.",
  good: "The transformation can be a bit more visible, but it must still remain realistic and natural.",
};

const safeText = (value = "") => String(value || "").trim();

const asNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildBodyMetricsText = ({ sourceSummary = {} }) => {
  const currentWeightKg = asNumberOrNull(sourceSummary.currentWeightKg);
  const bodyFatPercent = asNumberOrNull(sourceSummary.bodyFatPercent);
  const restingHeartRate = asNumberOrNull(sourceSummary.restingHeartRate);

  const lines = [];

  if (currentWeightKg !== null) {
    lines.push(`Current weight: ${currentWeightKg} kg.`);
  }

  if (bodyFatPercent !== null) {
    lines.push(`Current body fat: ${bodyFatPercent}%.`);
  }

  if (restingHeartRate !== null) {
    lines.push(`Resting heart rate: ${restingHeartRate} bpm.`);
  }

  return lines.join(" ");
};

const buildIdentityPreservationRules = () => [
  "Use the uploaded image of the same person as the reference.",
  "Keep the person recognizable.",
  "Keep the same person identity, similar pose, and similar camera angle.",
  "Preserve natural body proportions and realistic anatomy.",
  "Do not create an exaggerated or unrealistic fitness transformation.",
  "Do not change clothing style more than necessary.",
  "Keep the background simple and visually consistent when possible.",
];

const buildViewSpecificRules = (view = "front") => {
  if (view === "side") {
    return [
      "Generate the result from the same side-view orientation as the input image.",
      "Keep the side-standing pose similar to the reference image.",
      "Show the body transformation mainly through posture, silhouette, and body line from the side.",
    ];
  }

  return [
    "Generate the result from the same front-view orientation as the input image.",
    "Keep the front-facing standing pose similar to the reference image.",
    "Show the body transformation mainly through visible front-body balance, waist line, shoulder line, and overall physique.",
  ];
};

const buildTransformationRules = ({
  phaseProfile,
  goal,
  gender,
  overallPhysicalLevel,
  stage,
}) => {
  const lines = [];

  lines.push(
    `This is a realistic visual projection for ${phaseProfile.phaseLabel}.`,
  );
  lines.push(`Transformation intensity: ${phaseProfile.intensity}.`);
  lines.push(`Expected body change: ${phaseProfile.bodyChange}`);

  if (GOAL_PROMPT_HINTS[goal]) {
    lines.push(GOAL_PROMPT_HINTS[goal]);
  }

  if (GENDER_HINTS[gender]) {
    lines.push(GENDER_HINTS[gender]);
  }

  if (LEVEL_HINTS[overallPhysicalLevel]) {
    lines.push(LEVEL_HINTS[overallPhysicalLevel]);
  }

  if (safeText(stage?.visualSummary)) {
    lines.push(`Stage summary: ${safeText(stage.visualSummary)}`);
  }

  return lines;
};

const buildFrontPrompt = ({ customer, prediction, stage, phaseProfile }) => {
  const sourceSummary = prediction?.sourceSummary || {};
  const goal = safeText(sourceSummary.primaryGoal);
  const overallPhysicalLevel = safeText(sourceSummary.overallPhysicalLevel);
  const gender = safeText(customer?.gender);
  const bodyMetricsText = buildBodyMetricsText({ sourceSummary });

  const parts = [
    ...buildIdentityPreservationRules(),
    ...buildViewSpecificRules("front"),
    ...buildTransformationRules({
      phaseProfile,
      goal,
      gender,
      overallPhysicalLevel,
      stage,
    }),
    `Front-view focus: ${phaseProfile.frontFocus}`,
  ];

  if (safeText(stage?.frontDescriptor)) {
    parts.push(
      `Additional front-view guidance: ${safeText(stage.frontDescriptor)}`,
    );
  }

  if (bodyMetricsText) {
    parts.push(bodyMetricsText);
  }

  parts.push(
    "Create a clean, realistic after-training image that stays visually close to the original person and only changes the physique in a believable way.",
  );

  return parts.join(" ");
};

const buildSidePrompt = ({ customer, prediction, stage, phaseProfile }) => {
  const sourceSummary = prediction?.sourceSummary || {};
  const goal = safeText(sourceSummary.primaryGoal);
  const overallPhysicalLevel = safeText(sourceSummary.overallPhysicalLevel);
  const gender = safeText(customer?.gender);
  const bodyMetricsText = buildBodyMetricsText({ sourceSummary });

  const parts = [
    ...buildIdentityPreservationRules(),
    ...buildViewSpecificRules("side"),
    ...buildTransformationRules({
      phaseProfile,
      goal,
      gender,
      overallPhysicalLevel,
      stage,
    }),
    `Side-view focus: ${phaseProfile.sideFocus}`,
  ];

  if (safeText(stage?.sideDescriptor)) {
    parts.push(
      `Additional side-view guidance: ${safeText(stage.sideDescriptor)}`,
    );
  }

  if (bodyMetricsText) {
    parts.push(bodyMetricsText);
  }

  parts.push(
    "Create a clean, realistic after-training image that stays visually close to the original person and only changes the physique in a believable way.",
  );

  return parts.join(" ");
};

export const getStageByPhaseKey = (prediction, phaseKey) => {
  const stages = Array.isArray(prediction?.visualStages)
    ? prediction.visualStages
    : [];

  return stages.find((item) => item.phaseKey === phaseKey) || null;
};

export const normalizeForceRegenerate = (value) => Boolean(value);

export const buildStageImageGenerationPayload = ({
  customer,
  prediction,
  phaseKey,
  forceRegenerate = false,
}) => {
  const phaseProfile = PHASE_IMAGE_PROFILE[phaseKey];

  if (!phaseProfile) {
    const error = new Error("phaseKey không hợp lệ để tạo ảnh AI");
    error.status = 400;
    throw error;
  }

  const stage = getStageByPhaseKey(prediction, phaseKey);

  if (!stage) {
    const error = new Error(
      "Không tìm thấy phase tương ứng trong result prediction",
    );
    error.status = 404;
    throw error;
  }

  const beforeFrontUrl = safeText(prediction?.beforeImages?.frontUrl);
  const beforeSideUrl = safeText(prediction?.beforeImages?.sideUrl);

  if (!beforeFrontUrl || !beforeSideUrl) {
    const error = new Error(
      "Thiếu ảnh before front hoặc before side để tạo ảnh AI",
    );
    error.status = 400;
    throw error;
  }

  const alreadyGenerated =
    stage?.imageStatus === "generated" &&
    safeText(stage?.images?.frontUrl) &&
    safeText(stage?.images?.sideUrl);

  return {
    phaseKey,
    phaseLabel: phaseProfile.phaseLabel,
    forceRegenerate: normalizeForceRegenerate(forceRegenerate),
    alreadyGenerated,
    beforeImages: {
      frontUrl: beforeFrontUrl,
      sideUrl: beforeSideUrl,
    },
    prompts: {
      front: buildFrontPrompt({
        customer,
        prediction,
        stage,
        phaseProfile,
      }),
      side: buildSidePrompt({
        customer,
        prediction,
        stage,
        phaseProfile,
      }),
    },
    context: {
      customerCode: safeText(customer?.code),
      customerName: safeText(customer?.fullName),
      gender: safeText(customer?.gender),
      primaryGoal: safeText(prediction?.sourceSummary?.primaryGoal),
      overallPhysicalLevel: safeText(
        prediction?.sourceSummary?.overallPhysicalLevel,
      ),
      currentWeightKg: asNumberOrNull(
        prediction?.sourceSummary?.currentWeightKg,
      ),
      bodyFatPercent: asNumberOrNull(prediction?.sourceSummary?.bodyFatPercent),
      stageLabel: safeText(stage?.label),
    },
  };
};
