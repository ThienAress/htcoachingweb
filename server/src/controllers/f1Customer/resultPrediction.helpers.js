const PHASE_META = {
  phase_1: {
    order: 1,
    levelTitle: "Stabilization",
    phaseTitle: "Stabilization Endurance",
  },
  phase_2: {
    order: 2,
    levelTitle: "Strength",
    phaseTitle: "Strength Endurance",
  },
  phase_3: {
    order: 3,
    levelTitle: "Strength",
    phaseTitle: "Hypertrophy",
  },
  phase_4: {
    order: 4,
    levelTitle: "Strength",
    phaseTitle: "Maximal Strength",
  },
  phase_5: {
    order: 5,
    levelTitle: "Power",
    phaseTitle: "Power",
  },
};

const PHASE_ORDER = ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5"];

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const round1 = (num) => Number(Number(num || 0).toFixed(1));

const nextPhysicalLevel = (current = "average") => {
  const order = ["low", "below_average", "average", "good"];
  const idx = order.indexOf(current);
  if (idx === -1) return "average";
  return order[Math.min(idx + 1, order.length - 1)];
};

export const buildFramework = ({
  recommendedStartPhase,
  phaseCeiling,
  personalizedPath,
}) => ({
  levels: [
    {
      levelKey: "level_1",
      title: "Stabilization",
      phases: [
        {
          phaseKey: "phase_1",
          title: "Stabilization Endurance",
          order: 1,
        },
      ],
    },
    {
      levelKey: "level_2",
      title: "Strength",
      phases: [
        {
          phaseKey: "phase_2",
          title: "Strength Endurance",
          order: 2,
        },
        {
          phaseKey: "phase_3",
          title: "Hypertrophy",
          order: 3,
        },
        {
          phaseKey: "phase_4",
          title: "Maximal Strength",
          order: 4,
        },
      ],
    },
    {
      levelKey: "level_3",
      title: "Power",
      phases: [
        {
          phaseKey: "phase_5",
          title: "Power",
          order: 5,
        },
      ],
    },
  ],
  recommendedStartPhase,
  phaseCeiling,
  personalizedPath,
});

export const determinePhaseCeiling = ({ intake, assessment, aiReport }) => {
  const systemFlags = intake?.systemFlags || {};
  const training = intake?.trainingProfileGoal || {};
  const overall = assessment?.overallPhysicalLevel || "average";
  const recommendedStartPhase =
    aiReport?.recommendations?.recommendedStartPhase || "phase_1";

  if (systemFlags.testPermission === "modified_test") {
    return "phase_2";
  }

  if (
    systemFlags.medicalReviewFlag ||
    ["moderate", "severe"].includes(systemFlags.painFlag)
  ) {
    return "phase_2";
  }

  if (
    recommendedStartPhase === "phase_3" &&
    overall === "good" &&
    ["muscle_gain", "weight_gain"].includes(training.primaryGoal) &&
    ["intermediate", "advanced"].includes(training.trainingExperience) &&
    training.currentlyTraining
  ) {
    return "phase_3";
  }

  if (recommendedStartPhase === "phase_2") {
    return "phase_2";
  }

  return "phase_2";
};

export const buildPersonalizedPath = (startPhase, phaseCeiling) => {
  const startIdx = PHASE_ORDER.indexOf(startPhase);
  const endIdx = PHASE_ORDER.indexOf(phaseCeiling);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return [startPhase || "phase_1"];
  }

  return PHASE_ORDER.slice(startIdx, endIdx + 1);
};

export const estimatePhaseDuration = ({
  phaseKey,
  intake,
  assessment,
  aiReport,
}) => {
  const bodyMetrics = intake?.bodyMetrics || {};
  const systemFlags = intake?.systemFlags || {};
  const findings = aiReport?.findings || {};
  const primaryGoal = intake?.trainingProfileGoal?.primaryGoal || "";

  const bodyFat = Number(bodyMetrics.bodyFatPercent || 0);
  const restingHr = Number(bodyMetrics.restingHeartRate || 0);
  const compensationCount = Array.isArray(findings.compensationFlags)
    ? findings.compensationFlags.length
    : 0;
  const cardioFlagsCount = Array.isArray(findings.cardioFlags)
    ? findings.cardioFlags.length
    : 0;

  if (phaseKey === "phase_1") {
    let weeks = 6;

    if (systemFlags.testPermission === "modified_test") weeks += 2;
    if (bodyFat >= 28) weeks += 1;
    if (compensationCount >= 4) weeks += 1;
    if (restingHr >= 85 || cardioFlagsCount >= 2) weeks += 1;

    return clamp(weeks, 6, 10);
  }

  if (phaseKey === "phase_2") {
    let weeks = 8;

    if (primaryGoal === "fat_loss") weeks += 2;
    if (systemFlags.testPermission === "modified_test") weeks += 1;
    if (restingHr >= 85) weeks += 1;

    return clamp(weeks, 8, 12);
  }

  if (phaseKey === "phase_3") {
    let weeks = 10;

    if (primaryGoal === "muscle_gain" || primaryGoal === "weight_gain") {
      weeks += 2;
    }

    return clamp(weeks, 10, 14);
  }

  return 8;
};

const buildObjectiveByPhase = (phaseKey, primaryGoal) => {
  if (phaseKey === "phase_1") {
    return "Xây lại nền vận động an toàn, giúp cơ thể ổn định hơn và cải thiện khả năng kiểm soát chuyển động ngay từ đầu.";
  }

  if (phaseKey === "phase_2") {
    return primaryGoal === "fat_loss"
      ? "Tăng dần sức mạnh bền, giữ kỹ thuật ổn định và đẩy body composition theo hướng giảm mỡ thực tế hơn."
      : "Tăng dần sức mạnh bền, nâng khả năng chịu bài và vẫn giữ chất lượng chuyển động khi có tải.";
  }

  if (phaseKey === "phase_3") {
    return "Tập trung hơn vào phát triển cơ bắp, tăng tải có kiểm soát và cải thiện vóc dáng theo hướng săn chắc, rõ nét hơn.";
  }

  return "Tiếp tục cải thiện thể chất theo đúng giai đoạn phù hợp.";
};

const buildEntryReasonByPhase = ({
  phaseKey,
  intake,
  assessment,
  aiReport,
}) => {
  const systemFlags = intake?.systemFlags || {};
  const bodyMetrics = intake?.bodyMetrics || {};
  const overall = assessment?.overallPhysicalLevel || "average";
  const goal = intake?.trainingProfileGoal?.primaryGoal || "";
  const bodyFat = Number(bodyMetrics.bodyFatPercent || 0);

  if (phaseKey === "phase_1") {
    if (systemFlags.testPermission === "modified_test") {
      return "Với tình trạng hiện tại, khách nên bắt đầu ở một giai đoạn an toàn hơn để cơ thể làm quen lại với vận động và kiểm soát form tốt hơn trước khi tăng tiến nhanh.";
    }

    if (overall === "low" || overall === "below_average") {
      return "Nền thể chất hiện tại vẫn chưa đủ chắc để đi nhanh vào các block nặng hơn, nên cần ưu tiên xây nền vận động và khả năng chịu vận động trước.";
    }

    return "Đây là giai đoạn phù hợp để khách làm quen lại với vận động, chỉnh chất lượng chuyển động và xây nền thể lực ban đầu.";
  }

  if (phaseKey === "phase_2") {
    return goal === "fat_loss"
      ? "Sau giai đoạn đầu, khách phù hợp hơn với strength endurance vì vừa có thể tăng sức mạnh bền, vừa hỗ trợ cải thiện hình thể theo hướng giảm mỡ."
      : "Sau khi đã có nền ổn định hơn, khách có thể chuyển sang strength endurance để tăng sức mạnh bền và khả năng chịu khối lượng tập tốt hơn.";
  }

  if (phaseKey === "phase_3") {
    if (bodyFat <= 18) {
      return "Khách đã có nền tương đối tốt về thể trạng và body composition, nên có thể bắt đầu đi rõ hơn theo hướng phát triển cơ bắp.";
    }

    return "Ở thời điểm này, khách đã đủ nền để bước vào giai đoạn tập trung hơn cho phát triển cơ bắp thay vì chỉ dừng ở phần nền tảng.";
  }

  return "Khách phù hợp với giai đoạn này theo hồ sơ hiện tại.";
};

const buildExpectedChangesByPhase = ({ phaseKey, primaryGoal }) => {
  if (phaseKey === "phase_1") {
    return [
      "Chất lượng chuyển động ổn hơn",
      "Cảm giác cơ thể tốt hơn khi tập",
      "Nền chịu vận động được cải thiện rõ hơn",
    ];
  }

  if (phaseKey === "phase_2") {
    return primaryGoal === "fat_loss"
      ? [
          "Body composition cải thiện rõ hơn",
          "Sức mạnh bền và thể lực nền tốt hơn",
          "Khả năng giữ form dưới tải ổn định hơn",
        ]
      : [
          "Sức mạnh bền tăng rõ hơn",
          "Khả năng chịu bài tốt hơn",
          "Giữ kỹ thuật ổn hơn khi tập nặng vừa",
        ];
  }

  if (phaseKey === "phase_3") {
    return [
      "Khối cơ nhìn đầy hơn",
      "Vóc dáng săn chắc hơn",
      "Cơ thể phản ứng tốt hơn với tăng tải",
    ];
  }

  return ["Tiếp tục cải thiện theo đúng mục tiêu đã chọn"];
};

const buildExitCriteriaByPhase = (phaseKey) => {
  if (phaseKey === "phase_1") {
    return [
      "Chuyển động ổn hơn và ít bù trừ hơn",
      "Phản ứng với buổi tập ổn định hơn",
      "Khả năng chịu vận động cơ bản tốt hơn",
    ];
  }

  if (phaseKey === "phase_2") {
    return [
      "Giữ kỹ thuật tốt dưới tải vừa",
      "Hoàn thành khối lượng tập ổn định",
      "Hồi phục sau buổi tập ở mức tốt",
    ];
  }

  if (phaseKey === "phase_3") {
    return [
      "Phản ứng tốt với tăng tải",
      "Giữ hồi phục ổn định",
      "Hình thể đi đúng hướng mục tiêu",
    ];
  }

  return ["Đạt điều kiện để chuyển sang giai đoạn tiếp theo"];
};

export const buildPhaseRoadmap = ({
  personalizedPath,
  intake,
  assessment,
  aiReport,
}) => {
  const primaryGoal = intake?.trainingProfileGoal?.primaryGoal || "";
  const trainingFocus = aiReport?.recommendations?.trainingFocus || [];

  return personalizedPath.map((phaseKey, index) => {
    const meta = PHASE_META[phaseKey];
    const durationWeeks = estimatePhaseDuration({
      phaseKey,
      intake,
      assessment,
      aiReport,
    });

    return {
      stageOrder: index + 1,
      phaseKey,
      levelTitle: meta.levelTitle,
      phaseTitle: meta.phaseTitle,
      durationWeeks,
      objective: buildObjectiveByPhase(phaseKey, primaryGoal),
      entryReason: buildEntryReasonByPhase({
        phaseKey,
        intake,
        assessment,
        aiReport,
      }),
      keyFocus: trainingFocus.slice(0, 4),
      expectedChanges: buildExpectedChangesByPhase({
        phaseKey,
        primaryGoal,
      }),
      exitCriteria: buildExitCriteriaByPhase(phaseKey),
    };
  });
};

const buildBaselineMetrics = ({ intake, assessment }) => ({
  label: "Ban đầu",
  weightKg: Number(intake?.bodyMetrics?.weightKg || 0) || null,
  bodyFatPercent: Number(intake?.bodyMetrics?.bodyFatPercent || 0) || null,
  bmi: Number(intake?.bodyMetrics?.bmi || 0) || null,
  waistCm: Number(intake?.bodyMetrics?.waistCm || 0) || null,
  hipCm: Number(intake?.bodyMetrics?.hipCm || 0) || null,
  restingHeartRate: Number(intake?.bodyMetrics?.restingHeartRate || 0) || null,
  overallPhysicalLevel: assessment?.overallPhysicalLevel || "average",
});

const projectFatLossPhase = ({ phaseKey, weeks, current }) => {
  const weeklyWeightLoss =
    phaseKey === "phase_1" ? 0.28 : phaseKey === "phase_2" ? 0.35 : 0.2;

  const totalWeightDelta = round1(weeklyWeightLoss * weeks);
  const totalBodyFatDelta =
    phaseKey === "phase_1"
      ? round1(Math.min(2.5, 0.25 * weeks))
      : phaseKey === "phase_2"
        ? round1(Math.min(3.5, 0.28 * weeks))
        : round1(Math.min(2.0, 0.18 * weeks));

  const hrDelta = phaseKey === "phase_1" ? 3 : phaseKey === "phase_2" ? 4 : 2;

  const waistDelta =
    phaseKey === "phase_1"
      ? round1(0.35 * weeks)
      : phaseKey === "phase_2"
        ? round1(0.45 * weeks)
        : round1(0.22 * weeks);

  const hipDelta =
    phaseKey === "phase_1"
      ? round1(0.18 * weeks)
      : phaseKey === "phase_2"
        ? round1(0.25 * weeks)
        : round1(0.12 * weeks);

  return {
    weightKg: current.weightKg
      ? round1(current.weightKg - totalWeightDelta)
      : null,
    bodyFatPercent: current.bodyFatPercent
      ? round1(current.bodyFatPercent - totalBodyFatDelta)
      : null,
    bmi: current.bmi ? round1(current.bmi - totalWeightDelta * 0.3) : null,
    waistCm: current.waistCm
      ? Math.max(45, round1(current.waistCm - waistDelta))
      : null,
    hipCm: current.hipCm
      ? Math.max(55, round1(current.hipCm - hipDelta))
      : null,
    restingHeartRate: current.restingHeartRate
      ? Math.max(55, round1(current.restingHeartRate - hrDelta))
      : null,
    overallPhysicalLevel: nextPhysicalLevel(current.overallPhysicalLevel),
  };
};

const projectMuscleGainPhase = ({ phaseKey, weeks, current }) => {
  const weightGain =
    phaseKey === "phase_2" ? round1(0.12 * weeks) : round1(0.18 * weeks);

  const bodyFatDelta = phaseKey === "phase_2" ? -0.5 : -0.3;

  const waistDelta =
    phaseKey === "phase_2" ? round1(0.05 * weeks) : round1(0.02 * weeks);

  const hipGain =
    phaseKey === "phase_2" ? round1(0.12 * weeks) : round1(0.18 * weeks);

  return {
    weightKg: current.weightKg ? round1(current.weightKg + weightGain) : null,
    bodyFatPercent: current.bodyFatPercent
      ? round1(current.bodyFatPercent + bodyFatDelta)
      : null,
    bmi: current.bmi ? round1(current.bmi + weightGain * 0.3) : null,
    waistCm: current.waistCm ? round1(current.waistCm - waistDelta) : null,
    hipCm: current.hipCm ? round1(current.hipCm + hipGain) : null,
    restingHeartRate: current.restingHeartRate
      ? Math.max(55, round1(current.restingHeartRate - 1.5))
      : null,
    overallPhysicalLevel: nextPhysicalLevel(current.overallPhysicalLevel),
  };
};

const buildCheckpointSummary = ({ phaseKey, primaryGoal }) => {
  if (primaryGoal === "fat_loss") {
    if (phaseKey === "phase_1") {
      return "Kết thúc giai đoạn này, cơ thể thường gọn lại nhẹ, tư thế ổn hơn và nền tim mạch bắt đầu cải thiện.";
    }

    if (phaseKey === "phase_2") {
      return "Đến cuối giai đoạn này, khách thường thấy rõ hơn sự thay đổi về vóc dáng, sức bền và khả năng giữ form khi tập.";
    }
  }

  if (phaseKey === "phase_3") {
    return "Ở cuối giai đoạn này, cơ thể thường đầy hơn, chắc hơn và phản ứng tốt hơn với hướng phát triển cơ bắp.";
  }

  return "Khách tiếp tục cải thiện đều theo mục tiêu và đúng với lộ trình đã chọn.";
};

export const buildOutcomeTable = ({
  intake,
  assessment,
  personalizedPath,
  phaseRoadmap,
}) => {
  const primaryGoal = intake?.trainingProfileGoal?.primaryGoal || "";
  const baseline = buildBaselineMetrics({ intake, assessment });

  const phaseCheckpoints = [];
  let current = {
    ...baseline,
  };

  for (const stage of phaseRoadmap) {
    const projected =
      primaryGoal === "fat_loss"
        ? projectFatLossPhase({
            phaseKey: stage.phaseKey,
            weeks: stage.durationWeeks,
            current,
          })
        : projectMuscleGainPhase({
            phaseKey: stage.phaseKey,
            weeks: stage.durationWeeks,
            current,
          });

    const deltaFromBaseline = {
      weightKg:
        baseline.weightKg !== null && projected.weightKg !== null
          ? round1(projected.weightKg - baseline.weightKg)
          : null,
      bodyFatPercent:
        baseline.bodyFatPercent !== null && projected.bodyFatPercent !== null
          ? round1(projected.bodyFatPercent - baseline.bodyFatPercent)
          : null,
      bmi:
        baseline.bmi !== null && projected.bmi !== null
          ? round1(projected.bmi - baseline.bmi)
          : null,
      waistCm:
        baseline.waistCm !== null && projected.waistCm !== null
          ? round1(projected.waistCm - baseline.waistCm)
          : null,
      hipCm:
        baseline.hipCm !== null && projected.hipCm !== null
          ? round1(projected.hipCm - baseline.hipCm)
          : null,
      restingHeartRate:
        baseline.restingHeartRate !== null &&
        projected.restingHeartRate !== null
          ? round1(projected.restingHeartRate - baseline.restingHeartRate)
          : null,
    };

    phaseCheckpoints.push({
      phaseKey: stage.phaseKey,
      label: `Kết thúc ${PHASE_META[stage.phaseKey].phaseTitle}`,
      durationWeeks: stage.durationWeeks,
      projected,
      deltaFromBaseline,
      summary: buildCheckpointSummary({
        phaseKey: stage.phaseKey,
        primaryGoal,
      }),
    });

    current = {
      ...projected,
      label: current.label,
    };
  }

  return {
    metricColumns: [
      "weightKg",
      "bodyFatPercent",
      "bmi",
      "waistCm",
      "hipCm",
      "restingHeartRate",
      "overallPhysicalLevel",
    ],
    baseline,
    phaseCheckpoints,
  };
};

const normalizeGeneratedImagesByPhase = (generatedImagesByPhase = {}) => {
  if (!generatedImagesByPhase || typeof generatedImagesByPhase !== "object") {
    return {};
  }

  return generatedImagesByPhase;
};

const pickStageImages = (phaseKey, generatedImagesByPhase = {}) => {
  const stageImages = normalizeGeneratedImagesByPhase(generatedImagesByPhase)[
    phaseKey
  ] || {
    frontUrl: "",
    sideUrl: "",
  };

  const frontUrl = String(stageImages?.frontUrl || "").trim();
  const sideUrl = String(stageImages?.sideUrl || "").trim();

  const hasGeneratedImages = Boolean(frontUrl || sideUrl);

  return {
    imageStatus: hasGeneratedImages ? "generated" : "descriptor_only",
    images: {
      frontUrl,
      sideUrl,
    },
  };
};

export const buildVisualStages = ({
  personalizedPath,
  intake,
  assessment,
  generatedImagesByPhase = {},
}) => {
  const goal = intake?.trainingProfileGoal?.primaryGoal || "";
  const bodyFat = Number(intake?.bodyMetrics?.bodyFatPercent || 0);
  const overall = assessment?.overallPhysicalLevel || "average";

  return personalizedPath.map((phaseKey) => {
    const imagePayload = pickStageImages(phaseKey, generatedImagesByPhase);

    if (goal === "fat_loss") {
      if (phaseKey === "phase_1") {
        return {
          phaseKey,
          label: "Hình ảnh kỳ vọng sau Phase 1",
          visualSummary:
            "Ở giai đoạn này, vóc dáng thường bắt đầu gọn hơn nhẹ, tư thế ổn hơn và tổng thể nhìn cân đối hơn so với lúc đầu.",
          frontDescriptor:
            "Vùng eo bắt đầu gọn hơn, vai và lưng nhìn cân hơn, dáng đứng đỡ gượng hơn.",
          sideDescriptor:
            "Phần bụng giảm nhẹ, trục cơ thể ổn hơn và tư thế nhìn tự nhiên hơn.",
          ...imagePayload,
        };
      }

      return {
        phaseKey,
        label: `Hình ảnh kỳ vọng sau ${PHASE_META[phaseKey].phaseTitle}`,
        visualSummary:
          "Cơ thể thường gọn rõ hơn, eo xuống thấy rõ hơn và tổng thể nhìn săn chắc, khỏe khoắn hơn.",
        frontDescriptor:
          "Vòng eo gọn hơn rõ, phần vai và lưng nhìn sạch nét và chắc hơn.",
        sideDescriptor:
          "Phần bụng xuống rõ hơn, dáng đứng vững hơn và đường nét cơ thể nhìn gọn hơn.",
        ...imagePayload,
      };
    }

    if (phaseKey === "phase_2") {
      return {
        phaseKey,
        label: "Hình ảnh kỳ vọng sau Phase 2",
        visualSummary:
          "Ở giai đoạn này, cơ thể thường bắt đầu đầy hơn, tư thế vững hơn và nhìn khỏe khoắn hơn so với giai đoạn đầu.",
        frontDescriptor:
          "Vai và lưng nhìn chắc hơn, thân người cân đối hơn và tổng thể có form hơn.",
        sideDescriptor:
          "Dáng đứng vững hơn, phần thân trên nhìn đầy hơn và cảm giác cơ thể khỏe hơn.",
        ...imagePayload,
      };
    }

    return {
      phaseKey,
      label: `Hình ảnh kỳ vọng sau ${PHASE_META[phaseKey].phaseTitle}`,
      visualSummary:
        bodyFat <= 18 && overall === "good"
          ? "Cơ thể thường nhìn đầy đặn hơn, săn chắc hơn và rõ khối cơ hơn theo đúng hướng phát triển cơ bắp."
          : "Cơ thể nhìn chắc hơn, đầy hơn và tổng thể khỏe hơn rõ rệt.",
      frontDescriptor:
        "Thân trên và lower body nhìn đầy hơn, body line rõ hơn và tổng thể cân đối hơn.",
      sideDescriptor:
        "Tư thế vững hơn, thân người chắc hơn và cảm giác khỏe khoắn thể hiện rõ hơn.",
      ...imagePayload,
    };
  });
};
