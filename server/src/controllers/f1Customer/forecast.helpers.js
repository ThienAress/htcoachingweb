const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildForecastBlockers = ({ intake, assessment, aiReport }) => {
  const blockers = [];

  const sleepHours = Number(intake?.lifestyleNutrition?.sleepHours || 0);
  const stressLevel = intake?.lifestyleNutrition?.stressLevel || "";
  const trainingDays = Number(
    intake?.trainingProfileGoal?.trainingDaysPerWeek || 0,
  );

  if (sleepHours > 0 && sleepHours < 6) {
    blockers.push("sleep_low");
  }

  if (stressLevel === "high") {
    blockers.push("stress_high");
  }

  if (trainingDays > 0 && trainingDays < 3) {
    blockers.push("training_frequency_low");
  }

  if (aiReport?.findings?.riskFlags?.length) {
    blockers.push(...aiReport.findings.riskFlags);
  }

  if (aiReport?.findings?.cardioFlags?.length) {
    blockers.push(...aiReport.findings.cardioFlags);
  }

  if (assessment?.overallPhysicalLevel === "low") {
    blockers.push("physical_level_low");
  }

  return [...new Set(blockers)];
};

const buildForecastAssumptions = ({ intake }) => {
  const assumptions = [];

  const trainingDays = Number(
    intake?.trainingProfileGoal?.trainingDaysPerWeek || 0,
  );
  const sleepHours = Number(intake?.lifestyleNutrition?.sleepHours || 0);

  assumptions.push(
    trainingDays >= 3
      ? "Duy trì tối thiểu 3 buổi tập/tuần"
      : "Cần nâng tần suất lên tối thiểu 3 buổi tập/tuần để đạt forecast thực tế",
  );

  assumptions.push("Tuân thủ ăn uống và recovery ở mức ổn định");

  if (sleepHours > 0 && sleepHours < 6) {
    assumptions.push("Cần cải thiện giấc ngủ để tiến độ không bị chậm");
  }

  assumptions.push("Không có gián đoạn lớn về sức khỏe hoặc lịch tập");

  return assumptions;
};

const buildForecastMilestones = ({ primaryGoal }) => {
  if (primaryGoal === "fat_loss") {
    return [
      {
        week: 4,
        title: "Giai đoạn thích nghi",
        expectedChange:
          "Cải thiện nền vận động, kiểm soát form, bắt đầu giảm số đo nhẹ",
      },
      {
        week: 8,
        title: "Giai đoạn thấy thay đổi rõ",
        expectedChange:
          "Form tốt hơn, body bắt đầu gọn hơn, thể lực nền cải thiện",
      },
      {
        week: 12,
        title: "Giai đoạn thay đổi rõ về vóc dáng",
        expectedChange: "Mỡ giảm thấy rõ hơn nếu adherence ổn định",
      },
      {
        week: 16,
        title: "Giai đoạn củng cố kết quả",
        expectedChange: "Tiến gần hơn tới mục tiêu giảm mỡ / giảm cân thực tế",
      },
    ];
  }

  if (primaryGoal === "muscle_gain" || primaryGoal === "weight_gain") {
    return [
      {
        week: 4,
        title: "Giai đoạn xây nền",
        expectedChange: "Form chuẩn hơn, thích nghi với cường độ và volume",
      },
      {
        week: 8,
        title: "Giai đoạn tăng tiến rõ",
        expectedChange: "Sức mạnh tốt hơn, cơ thể bắt đầu đầy hơn",
      },
      {
        week: 12,
        title: "Giai đoạn tích lũy",
        expectedChange: "Khối lượng cơ và thể trạng tổng thể cải thiện rõ hơn",
      },
      {
        week: 16,
        title: "Giai đoạn định hình kết quả",
        expectedChange: "Body nhìn chắc hơn, đầy hơn nếu ăn và tập ổn định",
      },
    ];
  }

  return [
    {
      week: 4,
      title: "Giai đoạn xây nền",
      expectedChange: "Cải thiện mức vận động và khả năng thích nghi",
    },
    {
      week: 8,
      title: "Giai đoạn tiến bộ",
      expectedChange: "Thấy rõ hơn thay đổi về hiệu suất và kiểm soát cơ thể",
    },
    {
      week: 12,
      title: "Giai đoạn củng cố",
      expectedChange: "Ổn định kết quả và chuẩn bị bước tiếp theo",
    },
  ];
};

const estimateForecastCases = ({ intake, assessment, aiReport, blockers }) => {
  const goal = intake?.trainingProfileGoal?.primaryGoal || "";
  const currentWeightKg = safeNumber(intake?.bodyMetrics?.weightKg);
  const targetWeightKg = safeNumber(
    intake?.trainingProfileGoal?.targetWeightKg,
  );
  const overallPhysicalLevel = assessment?.overallPhysicalLevel || "average";

  let realisticMonths = 4;

  if (
    (goal === "fat_loss" || goal === "weight_gain" || goal === "muscle_gain") &&
    currentWeightKg &&
    targetWeightKg
  ) {
    const diff = Math.abs(targetWeightKg - currentWeightKg);

    if (goal === "fat_loss") {
      realisticMonths = Math.max(2, Math.ceil(diff / 2));
    } else if (goal === "weight_gain") {
      realisticMonths = Math.max(3, Math.ceil(diff / 1.5));
    } else if (goal === "muscle_gain") {
      realisticMonths = Math.max(4, Math.ceil(diff / 1.2));
    }
  } else {
    if (goal === "fat_loss") realisticMonths = 4;
    else if (goal === "weight_gain") realisticMonths = 5;
    else if (goal === "muscle_gain") realisticMonths = 6;
    else realisticMonths = 4;
  }

  if (overallPhysicalLevel === "low") realisticMonths += 1;
  if (overallPhysicalLevel === "below_average") realisticMonths += 1;

  if (blockers.includes("sleep_low")) realisticMonths += 1;
  if (blockers.includes("stress_high")) realisticMonths += 1;
  if (blockers.includes("training_frequency_low")) realisticMonths += 1;
  if (aiReport?.inputSummary?.readinessStatus === "caution")
    realisticMonths += 1;

  const fastMonths = Math.max(1, realisticMonths - 1);
  const slowMonths = realisticMonths + 2;

  return {
    fastCase: {
      months: fastMonths,
      summary:
        "Tiến độ nhanh nếu adherence cao, recovery tốt và tập luyện ổn định.",
    },
    realisticCase: {
      months: realisticMonths,
      summary:
        "Đây là kịch bản thực tế nhất nếu khách duy trì tập luyện và lối sống tương đối ổn định.",
    },
    slowCase: {
      months: slowMonths,
      summary:
        "Tiến độ chậm hơn nếu recovery thấp, stress cao hoặc tần suất tập không đủ.",
    },
  };
};

const buildForecastConfidence = ({ blockers, readinessStatus }) => {
  if (readinessStatus === "hold") return "low";
  if (blockers.length >= 4) return "low";
  if (blockers.length >= 2) return "medium";
  return "high";
};

export const buildOutcomeForecast = ({ intake, assessment, aiReport }) => {
  const blockers = buildForecastBlockers({ intake, assessment, aiReport });
  const assumptions = buildForecastAssumptions({ intake });
  const milestones = buildForecastMilestones({
    primaryGoal: intake?.trainingProfileGoal?.primaryGoal,
  });

  const cases = estimateForecastCases({
    intake,
    assessment,
    aiReport,
    blockers,
  });

  const confidence = buildForecastConfidence({
    blockers,
    readinessStatus: aiReport?.inputSummary?.readinessStatus,
  });

  return {
    forecastType: "goal_timeline_v1",
    inputSummary: {
      primaryGoal: intake?.trainingProfileGoal?.primaryGoal || "",
      currentWeightKg: safeNumber(intake?.bodyMetrics?.weightKg),
      targetWeightKg: safeNumber(intake?.trainingProfileGoal?.targetWeightKg),
      bodyFatPercent: safeNumber(intake?.bodyMetrics?.bodyFatPercent),
      readinessStatus: aiReport?.inputSummary?.readinessStatus || "",
      overallPhysicalLevel: assessment?.overallPhysicalLevel || "",
      trainingDaysPerWeek: safeNumber(
        intake?.trainingProfileGoal?.trainingDaysPerWeek,
      ),
      sleepHours: safeNumber(intake?.lifestyleNutrition?.sleepHours),
      stressLevel: intake?.lifestyleNutrition?.stressLevel || "",
    },
    forecast: {
      ...cases,
      confidence,
      blockers,
      assumptions,
      milestones,
    },
    engineVersion: "forecast-engine-v1",
  };
};
