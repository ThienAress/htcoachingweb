const PHASE_LABELS = {
  pending_review: "Chờ review thêm trước khi vào phase huấn luyện",
  phase_1: "Cấp độ 1 · Phase 1 - Stabilization Endurance",
  phase_2: "Cấp độ 2 · Phase 2 - Strength Endurance",
  phase_3: "Cấp độ 2 · Phase 3 - Muscular Development / Hypertrophy",
  phase_4: "Cấp độ 2 · Phase 4 - Maximal Strength",
  phase_5: "Cấp độ 3 · Phase 5 - Power",
};

const round1 = (num) => Number(Number(num || 0).toFixed(1));

const collectCompensations = (assessment) => {
  const posture = assessment?.postureAssessment || {};
  const ohsa = assessment?.movementAssessment?.overheadSquat || {};

  const postureFlags = [
    posture.feetAnkles,
    posture.knees,
    posture.lphc,
    posture.shouldersThoracic,
    posture.headNeck,
  ].filter((item) => item && item !== "normal");

  const movementFlags = [
    ...(ohsa.anterior || []),
    ...(ohsa.lateral || []),
    ...(ohsa.posterior || []),
  ];

  return [...new Set([...postureFlags, ...movementFlags])];
};

const buildRiskFlags = (intake) => {
  const flags = [];

  if (intake?.systemFlags?.medicalReviewFlag) {
    flags.push("medical_review_needed");
  }

  if (intake?.systemFlags?.testPermission === "hold_test") {
    flags.push("hold_test");
  }

  if (["moderate", "severe"].includes(intake?.systemFlags?.painFlag)) {
    flags.push("pain_alert");
  }

  return flags;
};

const buildLifestyleFlags = (intake) => {
  const flags = [];
  const lifestyle = intake?.lifestyleNutrition || {};

  if (Number(lifestyle.sleepHours) > 0 && Number(lifestyle.sleepHours) < 6) {
    flags.push("sleep_low");
  }

  if (lifestyle.stressLevel === "high") {
    flags.push("stress_high");
  }

  if (Number(lifestyle.mealsPerDay) > 0 && Number(lifestyle.mealsPerDay) <= 2) {
    flags.push("meals_low");
  }

  if (lifestyle.drinkEnoughWater === false) {
    flags.push("hydration_low");
  }

  if (lifestyle.usuallyEatOut === true) {
    flags.push("eat_out_often");
  }

  return flags;
};

const buildCorrectiveFocus = (compensationFlags = []) => {
  const focus = new Set();

  if (
    compensationFlags.includes("feet_turn_out") ||
    compensationFlags.includes("pes_planus") ||
    compensationFlags.includes("knee_valgus") ||
    compensationFlags.includes("knees_move_inward")
  ) {
    focus.add("glute_activation");
    focus.add("ankle_mobility");
    focus.add("single_leg_stability");
  }

  if (
    compensationFlags.includes("knee_varus") ||
    compensationFlags.includes("knees_move_outward")
  ) {
    focus.add("lower_body_alignment");
    focus.add("stability_training");
    focus.add("movement_foundation");
  }

  if (compensationFlags.includes("knee_hyperextension")) {
    focus.add("lower_body_alignment");
    focus.add("stability_training");
    focus.add("movement_foundation");
  }

  if (
    compensationFlags.includes("heel_rise") ||
    compensationFlags.includes("mild_heel_rise") ||
    compensationFlags.includes("excessive_forward_lean")
  ) {
    focus.add("ankle_mobility");
    focus.add("core_control");
    focus.add("squat_pattern_retraining");
  }

  if (
    compensationFlags.includes("anterior_pelvic_tilt") ||
    compensationFlags.includes("low_back_arch")
  ) {
    focus.add("lumbopelvic_control");
    focus.add("core_bracing");
    focus.add("hip_mobility");
  }

  if (
    compensationFlags.includes("posterior_pelvic_tilt") ||
    compensationFlags.includes("low_back_round")
  ) {
    focus.add("hip_mobility");
    focus.add("core_control");
    focus.add("movement_foundation");
  }

  if (
    compensationFlags.includes("pelvic_tilt_rotation") ||
    compensationFlags.includes("pelvic_shift")
  ) {
    focus.add("single_leg_stability");
    focus.add("lumbopelvic_control");
    focus.add("movement_foundation");
  }

  if (
    compensationFlags.includes("rounded_shoulders") ||
    compensationFlags.includes("arms_fall_forward")
  ) {
    focus.add("thoracic_mobility");
    focus.add("scapular_control");
  }

  if (
    compensationFlags.includes("elevated_shoulders") ||
    compensationFlags.includes("asymmetrical_shoulders")
  ) {
    focus.add("scapular_control");
    focus.add("posture_awareness");
  }

  if (compensationFlags.includes("thoracic_kyphosis")) {
    focus.add("thoracic_mobility");
    focus.add("thoracic_extension");
    focus.add("posture_awareness");
  }

  if (
    compensationFlags.includes("forward_head_posture") ||
    compensationFlags.includes("head_tilt_rotation")
  ) {
    focus.add("thoracic_extension");
    focus.add("posture_awareness");
    focus.add("cervical_alignment");
  }

  if (focus.size === 0) {
    focus.add("movement_foundation");
    focus.add("stability_training");
  }

  return Array.from(focus);
};

const normalizeLevel = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const isLowLevel = (value = "") => {
  const level = normalizeLevel(value);
  return level === "low" || level === "below_average";
};

const pushUnique = (arr, value) => {
  if (value && !arr.includes(value)) arr.push(value);
};

const collectPhysicalFlags = (assessment) => {
  const strengthFlags = [];
  const enduranceFlags = [];
  const cardioFlags = [];

  const strength = assessment?.strengthAssessment || {};
  const endurance = assessment?.enduranceAssessment || {};
  const cardio = assessment?.cardioAssessment || {};

  if (isLowLevel(strength?.upperBodyPush?.level)) {
    pushUnique(strengthFlags, "upper_body_push_low");
  }
  if (isLowLevel(strength?.upperBodyPull?.level)) {
    pushUnique(strengthFlags, "upper_body_pull_low");
  }
  if (isLowLevel(strength?.lowerBody?.level)) {
    pushUnique(strengthFlags, "lower_body_strength_low");
  }
  if (isLowLevel(strength?.coreStrength?.level)) {
    pushUnique(strengthFlags, "core_strength_low");
  }

  if (isLowLevel(endurance?.muscularEndurance?.level)) {
    pushUnique(enduranceFlags, "muscular_endurance_low");
  }
  if (isLowLevel(endurance?.coreEndurance?.level)) {
    pushUnique(enduranceFlags, "core_endurance_low");
  }

  const restingHeartRate = Number(cardio?.restingHeartRate || 0);

  if (restingHeartRate > 85) {
    pushUnique(cardioFlags, "resting_hr_elevated");
  }
  if (isLowLevel(cardio?.cardioCapacity?.level)) {
    pushUnique(cardioFlags, "cardio_capacity_low");
  }
  if (isLowLevel(cardio?.recoveryHeartRate?.level)) {
    pushUnique(cardioFlags, "recovery_heart_rate_low");
  }

  return {
    strengthFlags,
    enduranceFlags,
    cardioFlags,
  };
};

const determineRecommendedStartPhase = ({
  customer,
  intake,
  assessment,
  riskFlags,
  compensationFlags,
  strengthFlags,
  enduranceFlags,
  cardioFlags,
}) => {
  const readiness = customer?.readinessStatus || "pending";
  const overall = assessment?.overallPhysicalLevel || "average";
  const training = intake?.trainingProfileGoal || {};
  const health = intake?.healthScreening || {};
  const goal = training.primaryGoal || "";

  const compensationCount = compensationFlags.length;
  const lowPhysicalFlagCount =
    strengthFlags.length + enduranceFlags.length + cardioFlags.length;

  const experience = training.trainingExperience || "";
  const currentlyTraining = Boolean(training.currentlyTraining);
  const trainingDays = Number(training.trainingDaysPerWeek || 0);

  const hasCurrentConditions = Boolean((health.currentConditions || "").trim());
  const hasDoctorRestrictions = Boolean(
    (health.doctorRestrictions || "").trim(),
  );
  const hasWarningSigns =
    Array.isArray(health.warningSigns) && health.warningSigns.length > 0;
  const painFlag = intake?.systemFlags?.painFlag || "none";

  if (
    readiness === "hold" ||
    hasWarningSigns ||
    hasDoctorRestrictions ||
    painFlag === "severe"
  ) {
    return "pending_review";
  }

  // Chỉ ép Phase 1 khi khách thực sự cần khởi đầu bảo thủ
  if (
    (readiness === "caution" &&
      (hasCurrentConditions ||
        painFlag === "moderate" ||
        compensationCount >= 4 ||
        lowPhysicalFlagCount >= 2)) ||
    overall === "low" ||
    overall === "below_average"
  ) {
    return "phase_1";
  }

  // Khách có nền tốt, tập đều, goal tăng cơ / tăng cân -> Phase 3
  if (
    readiness === "ready" &&
    overall === "good" &&
    compensationCount <= 2 &&
    lowPhysicalFlagCount <= 1 &&
    (goal === "muscle_gain" || goal === "weight_gain") &&
    (experience === "intermediate" || experience === "advanced") &&
    currentlyTraining &&
    trainingDays >= 3
  ) {
    return "phase_3";
  }

  // Còn lại: khách ổn, không quá yếu, không có risk mạnh -> Phase 2
  return "phase_2";
};

const buildTrainingFocus = ({
  phase,
  primaryGoal,
  strengthFlags = [],
  enduranceFlags = [],
  cardioFlags = [],
  compensationFlags = [],
}) => {
  const focus = new Set();

  if (phase === "phase_1") {
    focus.add("movement_foundation");
    focus.add("stability_training");
    focus.add("core_control");
  }

  if (phase === "phase_2") {
    focus.add("strength_progression");
    focus.add("movement_quality_under_load");
    focus.add("muscular_endurance");
  }

  if (phase === "phase_3") {
    focus.add("strength_progression");
    focus.add("movement_quality_under_load");
  }

  if (primaryGoal === "fat_loss") {
    focus.add("energy_expenditure");
    focus.add("cardio_base_building");
  }

  if (primaryGoal === "muscle_gain" || primaryGoal === "weight_gain") {
    focus.add("strength_progression");
    focus.add("movement_quality_under_load");
  }

  if (strengthFlags.includes("lower_body_strength_low")) {
    focus.add("lower_body_strength");
  }
  if (strengthFlags.includes("core_strength_low")) {
    focus.add("core_strength");
  }
  if (enduranceFlags.includes("muscular_endurance_low")) {
    focus.add("muscular_endurance");
  }
  if (
    cardioFlags.includes("cardio_capacity_low") ||
    cardioFlags.includes("resting_hr_elevated")
  ) {
    focus.add("cardio_base_building");
  }

  if (
    compensationFlags.includes("knees_move_inward") ||
    compensationFlags.includes("excessive_forward_lean")
  ) {
    focus.add("pattern_retraining");
  }

  if (!focus.size) {
    focus.add("general_foundation");
  }

  return Array.from(focus);
};

// === ĐÃ CẬP NHẬT ===
const buildTrainingNotes = ({
  phase,
  intake,
  riskFlags,
  lifestyleFlags,
  compensationFlags,
  strengthFlags = [],
  enduranceFlags = [],
  cardioFlags = [],
}) => {
  const notes = [];

  if (phase === "pending_review") {
    notes.push(
      "Chưa nên đẩy khách vào giáo án chính thức cho đến khi làm rõ thêm yếu tố sức khỏe.",
    );
    notes.push(
      "Ưu tiên theo dõi triệu chứng, mức an toàn vận động và phản ứng cơ thể ở buổi đầu.",
    );
  }

  if (phase === "phase_1") {
    notes.push(
      "Ưu tiên các bài giúp khách cảm nhận cơ thể tốt hơn và kiểm soát chuyển động rõ hơn.",
    );
    notes.push(
      "Tempo nên chậm, tải vừa phải và độ khó bài tập nên tăng từ từ.",
    );
    notes.push(
      "Mục tiêu chính là xây lại nền ổn định, cảm nhận cơ thể và khả năng chịu vận động cơ bản.",
    );
  }

  if (phase === "phase_2") {
    notes.push(
      "Có thể bắt đầu tăng dần sức mạnh bền, nhưng vẫn cần giữ kỹ thuật ổn định ở từng bài.",
    );
    notes.push(
      "Nên ưu tiên các bài cơ bản, unilateral work và khối lượng vừa phải để khách thích nghi tốt.",
    );
    notes.push(
      "Volume có thể tăng dần nếu khách đáp ứng tốt và recovery ổn định.",
    );
  }

  if (phase === "phase_3") {
    notes.push(
      "Có thể đi theo hướng phát triển cơ bắp rõ ràng hơn với cấu trúc bài tập mạch lạc hơn.",
    );
    notes.push(
      "Ưu tiên progressive overload, volume đủ tốt và theo dõi recovery sát để tránh quá tải.",
    );
    notes.push(
      "Corrective lúc này chỉ cần giữ ở mức duy trì nếu khách không còn lỗi nổi bật.",
    );
  }

  if (lifestyleFlags.includes("sleep_low")) {
    notes.push("Nên để ý hồi phục vì thời lượng ngủ hiện tại còn thấp.");
  }

  if (lifestyleFlags.includes("stress_high")) {
    notes.push(
      "Nếu stress cao, nên giữ volume đầu vào vừa phải thay vì tăng nhanh.",
    );
  }

  if (
    compensationFlags.includes("knees_move_inward") ||
    compensationFlags.includes("excessive_forward_lean")
  ) {
    notes.push(
      "Chưa nên tăng nhanh các bài squat nặng khi pattern vận động vẫn chưa thật sự ổn.",
    );
  }

  if (riskFlags.includes("medical_review_needed")) {
    notes.push(
      "Cần giữ sự thận trọng với yếu tố sức khỏe trước khi tăng cường độ tập.",
    );
  }

  if (strengthFlags.includes("core_strength_low")) {
    notes.push("Nên nâng nền core trước khi đẩy nhanh các bài compound.");
  }

  if (strengthFlags.includes("lower_body_strength_low")) {
    notes.push(
      "Sức mạnh thân dưới nên được tăng dần bằng các bài cơ bản, dễ kiểm soát form.",
    );
  }

  if (enduranceFlags.includes("muscular_endurance_low")) {
    notes.push(
      "Nên tăng volume từ từ, tránh dồn mật độ bài tập quá sớm ngay giai đoạn đầu.",
    );
  }

  if (cardioFlags.includes("cardio_capacity_low")) {
    notes.push(
      "Nên bổ sung cardio nền cường độ vừa để cải thiện khả năng chịu vận động tổng thể.",
    );
  }

  if (cardioFlags.includes("resting_hr_elevated")) {
    notes.push(
      "Nên theo dõi nhịp tim nghỉ và mức hồi phục trước khi nâng volume thêm.",
    );
  }

  return [...new Set(notes)];
};

const mapReadinessLabel = (value = "pending") => {
  const map = {
    pending: "chờ đánh giá",
    ready: "sẵn sàng tập luyện",
    caution: "cần điều chỉnh",
    hold: "tạm hoãn tập luyện",
  };
  return map[value] || value;
};

const mapPainLabel = (value = "none") => {
  const map = {
    none: "không có đau nổi bật",
    mild: "đau mức nhẹ",
    moderate: "đau mức trung bình",
    severe: "đau mức nghiêm trọng",
  };
  return map[value] || value;
};

const mapGoalLabel = (value = "") => {
  const map = {
    fat_loss: "giảm mỡ",
    weight_gain: "tăng cân",
    muscle_gain: "tăng cơ",
    maintenance: "duy trì thể trạng",
  };
  return map[value] || value || "chưa xác định mục tiêu";
};

const mapPhysicalLevelLabel = (value = "average") => {
  const map = {
    low: "thấp",
    below_average: "dưới trung bình",
    average: "trung bình",
    good: "tốt",
  };
  return map[value] || value;
};

const mapPhaseLabel = (value = "phase_1") =>
  PHASE_LABELS[value] || value || PHASE_LABELS.phase_1;

const translateLifestyleFlags = (flags = []) => {
  const map = {
    sleep_low: "ngủ chưa đủ",
    stress_high: "stress cao",
    meals_low: "số bữa ăn còn ít",
    hydration_low: "uống nước chưa đủ",
    eat_out_often: "ăn ngoài thường xuyên",
  };
  return flags.map((item) => map[item] || item);
};

const translateRiskFlags = (flags = []) => {
  const map = {
    medical_review_needed: "cần rà soát y tế",
    hold_test: "tạm hoãn test",
    pain_alert: "có cảnh báo đau",
  };
  return flags.map((item) => map[item] || item);
};

const translateStrengthFlags = (flags = []) => {
  const map = {
    upper_body_push_low: "sức mạnh đẩy thân trên còn thấp",
    upper_body_pull_low: "sức mạnh kéo thân trên còn thấp",
    lower_body_strength_low: "sức mạnh thân dưới còn thấp",
    core_strength_low: "sức mạnh core còn thấp",
  };
  return flags.map((item) => map[item] || item);
};

const translateEnduranceFlags = (flags = []) => {
  const map = {
    muscular_endurance_low: "sức bền cơ còn thấp",
    core_endurance_low: "sức bền core còn thấp",
  };
  return flags.map((item) => map[item] || item);
};

const translateCardioFlags = (flags = []) => {
  const map = {
    resting_hr_elevated: "nhịp tim nghỉ cao",
    cardio_capacity_low: "năng lực tim mạch còn thấp",
    recovery_heart_rate_low: "khả năng hồi phục tim mạch còn thấp",
  };
  return flags.map((item) => map[item] || item);
};

const translateCompensationFlags = (flags = []) => {
  const map = {
    feet_turn_out: "bàn chân xoay ra ngoài",
    pes_planus: "bàn chân bẹt / sập vòm",
    knee_valgus: "gối xoay vào trong",
    knees_move_inward: "gối chụm vào trong",
    knee_varus: "gối đẩy ra ngoài",
    knees_move_outward: "gối đẩy ra ngoài",
    knee_hyperextension: "ưỡn gối quá mức",
    heel_rise: "gót chân nhấc lên",
    mild_heel_rise: "gót chân nhấc lên nhẹ",
    excessive_forward_lean: "đổ người về trước quá mức",
    anterior_pelvic_tilt: "nghiêng khung chậu ra trước",
    low_back_arch: "võng thắt lưng",
    posterior_pelvic_tilt: "nghiêng khung chậu ra sau",
    low_back_round: "tròn / cụp lưng dưới",
    pelvic_tilt_rotation: "hông không cân bằng",
    pelvic_shift: "hông lệch bấp bênh",
    rounded_shoulders: "vai tròn / cuộn vai ra trước",
    arms_fall_forward: "tay rớt về phía trước",
    elevated_shoulders: "vai nhô cao",
    asymmetrical_shoulders: "vai lệch không đều",
    thoracic_kyphosis: "lưng gù",
    forward_head_posture: "đầu đưa ra trước",
    head_tilt_rotation: "đầu nghiêng hoặc xoay",
  };
  return flags.map((item) => map[item] || item);
};

const translateCorrectiveFocus = (items = []) => {
  const map = {
    glute_activation: "kích hoạt cơ mông",
    ankle_mobility: "cải thiện linh hoạt cổ chân",
    single_leg_stability: "tăng ổn định một chân",
    lower_body_alignment: "chỉnh trục thân dưới",
    stability_training: "tăng ổn định nền tảng",
    movement_foundation: "xây nền chuyển động",
    core_control: "tăng kiểm soát core",
    squat_pattern_retraining: "học lại pattern squat",
    lumbopelvic_control: "kiểm soát lưng - chậu",
    core_bracing: "học siết core",
    hip_mobility: "cải thiện linh hoạt hông",
    thoracic_mobility: "cải thiện linh hoạt lưng ngực",
    scapular_control: "kiểm soát xương bả vai",
    posture_awareness: "nhận thức tư thế",
    thoracic_extension: "cải thiện ưỡn lưng ngực",
    cervical_alignment: "căn chỉnh cổ",
  };
  return items.map((item) => map[item] || item);
};

const translateTrainingFocus = (items = []) => {
  const map = {
    energy_expenditure: "tăng tiêu hao năng lượng",
    cardio_base_building: "xây nền tim mạch",
    strength_progression: "tăng tiến sức mạnh",
    movement_quality_under_load: "cải thiện chất lượng chuyển động khi có tải",
    lower_body_strength: "ưu tiên sức mạnh thân dưới",
    core_strength: "ưu tiên sức mạnh core",
    muscular_endurance: "ưu tiên sức bền cơ",
    pattern_retraining: "học lại pattern vận động",
    general_foundation: "xây nền tổng quát",
    movement_foundation: "xây nền chuyển động",
    stability_training: "tăng ổn định nền tảng",
    core_control: "tăng kiểm soát core",
  };
  return items.map((item) => map[item] || item);
};

const averageNumbers = (items = []) => {
  const valid = items
    .map((item) => {
      const parsed = Number(item);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((item) => item !== null);

  if (!valid.length) return null;
  return round1(valid.reduce((sum, item) => sum + item, 0) / valid.length);
};

const computeStaticPostureScore = (assessment = {}) => {
  const posture = assessment?.postureAssessment || {};
  const issues = [
    posture.feetAnkles,
    posture.knees,
    posture.lphc,
    posture.shouldersThoracic,
    posture.headNeck,
  ].filter((item) => item && item !== "normal");

  return round1(Math.max(10 - issues.length * 1.5, 0));
};

const computeOhsaScore = (assessment = {}) => {
  const ohsa = assessment?.movementAssessment?.overheadSquat || {};
  const totalCompensations = [
    ...(ohsa.anterior || []),
    ...(ohsa.lateral || []),
    ...(ohsa.posterior || []),
  ].length;

  return round1(Math.max(10 - totalCompensations * 1.25, 0));
};

const computePostureChartScore = (assessment = {}) => {
  return (
    averageNumbers([
      computeStaticPostureScore(assessment),
      computeOhsaScore(assessment),
    ]) || 0
  );
};

const computeStrengthChartScore = (assessment = {}) =>
  averageNumbers([
    assessment?.strengthAssessment?.upperBodyPush?.score,
    assessment?.strengthAssessment?.upperBodyPull?.score,
    assessment?.strengthAssessment?.lowerBody?.score,
    assessment?.strengthAssessment?.coreStrength?.score,
  ]) || 0;

const computeEnduranceChartScore = (assessment = {}) =>
  averageNumbers([
    assessment?.enduranceAssessment?.muscularEndurance?.score,
    assessment?.enduranceAssessment?.coreEndurance?.score,
  ]) || 0;

const computeRestingHrChartScore = (restingHeartRate) => {
  const hr = Number(restingHeartRate || 0);
  if (!Number.isFinite(hr) || hr <= 0) return null;
  if (hr <= 60) return 10;
  if (hr <= 70) return 8.5;
  if (hr <= 80) return 7;
  if (hr <= 90) return 5;
  if (hr <= 100) return 3.5;
  return 2;
};

const computeCardioChartScore = (assessment = {}) =>
  averageNumbers([
    assessment?.cardioAssessment?.cardioCapacity?.score,
    assessment?.cardioAssessment?.recoveryHeartRate?.score,
    computeRestingHrChartScore(assessment?.cardioAssessment?.restingHeartRate),
  ]) || 0;

const mapWorkActivityLabel = (value = "") => {
  const map = {
    sedentary: "thiên về ngồi nhiều",
    standing: "đứng nhiều",
    active: "vận động mức khá",
    heavy_labor: "lao động nặng",
  };
  return map[value] || value || "chưa có dữ liệu";
};

const getGenderLabel = (value = "") => {
  const map = {
    male: "nam",
    female: "nữ",
    other: "người tập",
  };
  return map[value] || "người tập";
};

const buildBodyFatComment = (gender = "", bodyFat = 0) => {
  const value = Number(bodyFat || 0);
  if (!Number.isFinite(value) || value <= 0) return null;

  const isMale = gender === "male";
  const fitThreshold = isMale ? 15 : 24;
  const elevatedThreshold = isMale ? 20 : 30;
  const highThreshold = isMale ? 25 : 35;

  if (value >= highThreshold) {
    return `Với body fat khoảng ${value}%, đây là mức cao đối với ${getGenderLabel(gender)}. Nếu không cải thiện vận động và dinh dưỡng, nguy cơ tích lũy mỡ nội tạng, rối loạn chuyển hóa và các vấn đề sức khỏe liên quan sẽ tăng dần theo thời gian.`;
  }

  if (value >= elevatedThreshold) {
    return `Body fat hiện tại khoảng ${value}% đang cao hơn vùng nên hướng tới đối với ${getGenderLabel(gender)}. Khách nên ưu tiên cải thiện vận động, hồi phục và kiểm soát dinh dưỡng để kéo body fat về vùng an toàn hơn.`;
  }

  if (value > fitThreshold) {
    return `Body fat khoảng ${value}% đang ở vùng có thể cải thiện thêm. Nếu mục tiêu là tối ưu hình thể, khách nên tiếp tục giảm dần về vùng gọn gàng hơn.`;
  }

  return `Body fat hiện tại khoảng ${value}% đang ở mức tương đối ổn để xây nền và tối ưu dần chất lượng hình thể.`;
};

const buildBmiComment = (bmi = 0) => {
  const value = Number(bmi || 0);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (value >= 30) {
    return `BMI khoảng ${value} cho thấy thể trạng đang ở mức béo phì. Điều này cần được lưu ý khi thiết kế volume, cardio và tốc độ progression ban đầu.`;
  }

  if (value >= 25) {
    return `BMI khoảng ${value} đang ở vùng thừa cân. Khách nên ưu tiên tăng vận động, cải thiện chất lượng ăn uống và kiểm soát body composition trong giai đoạn đầu.`;
  }

  if (value < 18.5) {
    return `BMI khoảng ${value} đang ở vùng khá thấp. Nếu mục tiêu là tăng cân hoặc tăng cơ, cần chú ý nền dinh dưỡng và khả năng hồi phục.`;
  }

  return `BMI khoảng ${value} đang ở vùng tương đối ổn để bắt đầu lộ trình tập luyện bài bản.`;
};

const buildWeaknessSummary = ({
  strengthFlags = [],
  enduranceFlags = [],
  cardioFlags = [],
  compensationFlags = [],
}) => {
  const parts = [];
  const translatedStrength = translateStrengthFlags(strengthFlags);
  const translatedEndurance = translateEnduranceFlags(enduranceFlags);
  const translatedCardio = translateCardioFlags(cardioFlags);
  const translatedComp = translateCompensationFlags(compensationFlags);

  if (translatedComp.length) {
    parts.push(
      `Ở phần vận động, khách đang có một vài lỗi đáng chú ý như ${translatedComp
        .slice(0, 2)
        .join(", ")}.`,
    );
  }

  const physicalWeakness = [
    ...translatedStrength,
    ...translatedEndurance,
  ].slice(0, 3);

  if (physicalWeakness.length) {
    parts.push(
      `Về thể lực nền, những điểm còn yếu rõ nhất hiện tại là ${physicalWeakness.join(", ")}.`,
    );
  }

  if (translatedCardio.length) {
    parts.push(
      `Ở phần tim mạch, điểm cần lưu ý lúc này là ${translatedCardio
        .slice(0, 2)
        .join(
          ", ",
        )}, nên PT vẫn cần xây nền work capacity trước khi tăng mật độ bài tập.`,
    );
  }

  if (!parts.length) {
    parts.push(
      "Từ assessment hiện tại chưa thấy điểm yếu nào quá nổi bật, tuy vậy PT vẫn nên ưu tiên chất lượng chuyển động và tăng tải theo hướng từ tốn.",
    );
  }

  return parts;
};

// === ĐÃ CẬP NHẬT ===
const buildPositiveHealthSummary = (readinessLabel) =>
  `Hiện tại chưa thấy yếu tố sức khỏe nào nổi bật đến mức cản trở việc bắt đầu tập luyện. Với mức sẵn sàng ${readinessLabel}, khách có thể vào lộ trình cơ bản và theo dõi phản ứng cơ thể kỹ hơn trong 2 tuần đầu.`;

// === ĐÃ CẬP NHẬT ===
const buildQuickOverviewByPhase = ({
  phase,
  readinessLabel,
  goalLabel,
  overallLabel,
  keyIssues = [],
}) => {
  const issueText = keyIssues.length
    ? ` Điểm PT nên lưu ý trước tiên là ${keyIssues.slice(0, 2).join(", ")}.`
    : "";

  if (phase === "pending_review") {
    return {
      headline:
        "Hiện tại khách chưa phù hợp để vào block tập chính thức. Nên review thêm về sức khỏe và mức an toàn vận động trước khi chốt hướng triển khai.",
      coachConclusion: `Mức sẵn sàng hiện tại là ${readinessLabel}. Mục tiêu chính là ${goalLabel}, nhưng ở thời điểm này PT nên ưu tiên an toàn, xác nhận thêm yếu tố sức khỏe và tránh đẩy progression quá sớm.${issueText}`,
    };
  }

  if (phase === "phase_1") {
    return {
      headline:
        "Khách phù hợp bắt đầu từ Cấp độ 1 · Phase 1 - Stabilization Endurance để xây nền ổn định, cải thiện kiểm soát chuyển động và vào lộ trình một cách an toàn.",
      coachConclusion: `Khách đang ở mức ${overallLabel}, mục tiêu chính là ${goalLabel}. Giai đoạn đầu nên đi theo hướng chỉnh movement, tăng stability và làm quen lại với nhịp tập trước khi tăng tải mạnh hơn.${issueText}`,
    };
  }

  if (phase === "phase_2") {
    return {
      headline:
        "Khách có thể bắt đầu ở Cấp độ 2 · Phase 2 - Strength Endurance. Đây là giai đoạn phù hợp để vừa xây sức mạnh bền, vừa tiếp tục giữ chất lượng chuyển động.",
      coachConclusion: `Khách đang ở mức ${overallLabel}, mục tiêu chính là ${goalLabel}. Có thể triển khai block strength endurance với volume vừa phải, vẫn giữ corrective ở phần khởi động nếu cần.${issueText}`,
    };
  }

  return {
    headline:
      "Khách có thể vào Cấp độ 2 · Phase 3 - Muscular Development / Hypertrophy vì nền vận động, thể lực và mức sẵn sàng hiện tại đã phù hợp hơn với block phát triển cơ bắp.",
    coachConclusion: `Khách đang ở mức ${overallLabel}, mục tiêu chính là ${goalLabel}. PT có thể ưu tiên progressive overload, volume hypertrophy và theo dõi recovery sát để giữ chất lượng buổi tập.${issueText}`,
  };
};

// === ĐÃ CẬP NHẬT ===
const buildStartupPlanByPhase = ({
  phase,
  correctiveFocus,
  trainingFocus,
  trainingNotes,
}) => {
  const translatedCorrective = translateCorrectiveFocus(correctiveFocus);
  const translatedTraining = translateTrainingFocus(trainingFocus);

  if (phase === "pending_review") {
    return {
      startPhase: phase,
      combinedPlan: [
        "Tạm thời chưa nên vào block tập chính thức.",
        "Ưu tiên làm rõ thêm triệu chứng, bệnh lý, thuốc đang dùng và giới hạn vận động nếu có.",
        "Buổi đầu nên xem như buổi rà soát lại thể trạng, kiểm tra movement nhẹ và quan sát phản ứng cơ thể.",
        "Chỉ nên chuyển sang phase huấn luyện khi mức độ an toàn đã rõ ràng hơn.",
      ],
      cautions: Array.from(trainingNotes),
    };
  }

  if (phase === "phase_1") {
    return {
      startPhase: phase,
      combinedPlan: [
        "Mỗi buổi nên bắt đầu bằng phần warm-up corrective rõ ràng, dễ theo dõi và dễ kiểm soát.",
        `Ưu tiên trước mắt: ${
          translatedCorrective.slice(0, 2).join(", ") ||
          "xây nền chuyển động, tăng ổn định nền tảng"
        }.`,
        "Bài tập nên giữ ở mức đơn giản, tempo chậm, tải vừa phải và chưa cần độ phức tạp cao.",
        "Trọng tâm giai đoạn này là alignment, core control, breathing và nền work capacity.",
        `Hướng huấn luyện chính: ${
          translatedTraining.slice(0, 2).join(", ") || "xây nền tổng quát"
        }.`,
      ],
      cautions: Array.from(trainingNotes),
    };
  }

  if (phase === "phase_2") {
    return {
      startPhase: phase,
      combinedPlan: [
        "Có thể bắt đầu block strength endurance thay vì chỉ dừng ở giai đoạn ổn định nền.",
        "Nên ưu tiên các cặp bài kiểu strength + stabilization để vừa tăng sức mạnh, vừa giữ movement quality.",
        "Tập trung vào unilateral basics, compound cơ bản và khối lượng vừa phải để khách thích nghi tốt.",
        `Hướng huấn luyện chính: ${
          translatedTraining.slice(0, 3).join(", ") ||
          "tăng tiến sức mạnh, cải thiện chất lượng chuyển động khi có tải"
        }.`,
        "Corrective vẫn nên giữ ở phần khởi động hoặc block ngắn nếu khách còn lỗi cần duy trì.",
      ],
      cautions: Array.from(trainingNotes),
    };
  }

  return {
    startPhase: phase,
    combinedPlan: [
      "Có thể vào block hypertrophy rõ ràng hơn thay vì tiếp tục đi theo hướng nền tảng.",
      "Nên tổ chức buổi tập theo hướng compound + accessory, volume đủ tốt và progressive overload có kiểm soát.",
      "PT cần theo dõi recovery, soreness và mức bám dinh dưỡng sát hơn so với phase 1-2.",
      `Hướng huấn luyện chính: ${
        translatedTraining.slice(0, 3).join(", ") ||
        "tăng tiến sức mạnh, cải thiện chất lượng chuyển động khi có tải"
      }.`,
      "Corrective lúc này chỉ nên giữ vai trò duy trì ở warm-up nếu khách không còn lỗi nổi bật.",
    ],
    cautions: Array.from(trainingNotes),
  };
};

const buildAiReportSummary = ({
  customer,
  intake,
  assessment,
  riskFlags,
  lifestyleFlags,
  compensationFlags,
  strengthFlags,
  enduranceFlags,
  cardioFlags,
  correctiveFocus,
  trainingFocus,
  trainingNotes,
  recommendedStartPhase,
}) => {
  const readinessStatus = customer?.readinessStatus || "pending";
  const painFlag = intake?.systemFlags?.painFlag || "none";
  const primaryGoal = intake?.trainingProfileGoal?.primaryGoal || "";
  const overallPhysicalLevel = assessment?.overallPhysicalLevel || "average";

  const readinessLabel = mapReadinessLabel(readinessStatus);
  const goalLabel = mapGoalLabel(primaryGoal);
  const overallLabel = mapPhysicalLevelLabel(overallPhysicalLevel);

  const healthScreening = intake?.healthScreening || {};
  const lifestyle = intake?.lifestyleNutrition || {};
  const bodyMetrics = intake?.bodyMetrics || {};
  const customerInfo = intake?.customerInfo || {};

  const gender = customerInfo.gender || customer?.gender || "";
  const warningSigns = Array.isArray(healthScreening.warningSigns)
    ? healthScreening.warningSigns
    : [];
  const painLevel = Number(healthScreening.painLevel || 0);
  const sleepHours = Number(lifestyle.sleepHours || 0);
  const mealsPerDay = Number(lifestyle.mealsPerDay || 0);
  const stressLevel = lifestyle.stressLevel || "";
  const bodyFat = Number(bodyMetrics.bodyFatPercent || 0);
  const bmi = Number(bodyMetrics.bmi || 0);
  const restingHr = Number(bodyMetrics.restingHeartRate || 0);

  const translatedRisk = translateRiskFlags(riskFlags);
  const translatedComp = translateCompensationFlags(compensationFlags);
  const translatedStrength = translateStrengthFlags(strengthFlags);
  const translatedEndurance = translateEnduranceFlags(enduranceFlags);
  const translatedCardio = translateCardioFlags(cardioFlags);

  const keyIssues = [
    ...translatedRisk,
    ...translatedComp,
    ...translatedStrength,
    ...translatedEndurance,
    ...translatedCardio,
  ];

  const quickOverview = buildQuickOverviewByPhase({
    phase: recommendedStartPhase,
    readinessLabel,
    goalLabel,
    overallLabel,
    keyIssues,
  });

  const health = [];

  if (
    healthScreening.currentConditions ||
    healthScreening.doctorRestrictions ||
    warningSigns.length
  ) {
    let sentence = "Intake đang ghi nhận một vài yếu tố sức khỏe cần lưu ý";
    const details = [];

    if (healthScreening.currentConditions) {
      details.push(`bệnh lý hiện tại: ${healthScreening.currentConditions}`);
    }

    if (healthScreening.doctorRestrictions) {
      details.push(`giới hạn từ bác sĩ: ${healthScreening.doctorRestrictions}`);
    }

    if (warningSigns.length) {
      details.push(`dấu hiệu cảnh báo: ${warningSigns.join(", ")}`);
    }

    if (details.length) {
      sentence += ` (${details.join(" | ")})`;
    }

    sentence +=
      ". Vì vậy giai đoạn đầu nên đi theo hướng thận trọng và theo dõi phản ứng cơ thể kỹ hơn.";

    health.push(sentence);
  } else {
    health.push(buildPositiveHealthSummary(readinessLabel));
  }

  if (painFlag === "none" || painLevel <= 0) {
    health.push(
      "Hiện tại khách không có dấu hiệu đau rõ rệt, đây là lợi thế để bắt đầu tập và theo dõi khả năng thích nghi trong những buổi đầu.",
    );
  } else if (painLevel >= 5) {
    health.push(
      `Mức đau hiện tại khoảng ${painLevel}/10 cho thấy cơ thể chưa thật sự ổn định. PT nên kiểm soát bài tập và cường độ chặt hơn để tránh quá tải sớm.`,
    );
  } else {
    health.push(
      `Khách đang có cảm giác đau ở mức ${painLevel}/10. Mức này chưa quá nghiêm trọng nhưng vẫn cần được lưu ý khi chọn bài và tăng tải.`,
    );
  }

  const physical = [
    `Mức thể chất tổng thể hiện tại ở mức ${overallLabel}. ${
      overallPhysicalLevel === "good"
        ? "Đây là nền khá tốt để tiến triển bài bản."
        : overallPhysicalLevel === "average"
          ? "Khách đã có nền cơ bản nhưng vẫn cần xây chắc thêm trước khi tăng tải mạnh."
          : "PT nên ưu tiên xây lại nền thể lực trước khi đẩy progression nhanh."
    }`,
    ...buildWeaknessSummary({
      strengthFlags,
      enduranceFlags,
      cardioFlags,
      compensationFlags,
    }),
  ];

  const bmiComment = buildBmiComment(bmi);
  if (bmiComment) physical.push(bmiComment);

  const lifestyleReview = [];

  if (sleepHours > 0) {
    lifestyleReview.push(
      sleepHours < 6
        ? `Khách hiện ngủ khoảng ${sleepHours} giờ mỗi đêm, đây là mức khá thấp và có thể ảnh hưởng đến hồi phục cũng như tiến độ tập luyện.`
        : `Khách hiện ngủ khoảng ${sleepHours} giờ mỗi đêm, đây là nền tương đối ổn cho giai đoạn bắt đầu nếu duy trì đều.`,
    );
  }

  if (stressLevel) {
    lifestyleReview.push(
      stressLevel === "high"
        ? "Mức stress hiện tại khá cao, vì vậy PT nên tăng volume từ từ và quan sát phản ứng cơ thể sát hơn."
        : stressLevel === "medium"
          ? "Stress đang ở mức trung bình, vẫn nên theo dõi cảm giác mệt và khả năng hồi phục trong giai đoạn đầu."
          : "Stress hiện tương đối thấp, đây là một điểm thuận lợi cho hồi phục và khả năng bám lộ trình.",
    );
  }

  lifestyleReview.push(
    `Tính chất công việc hiện tại ${mapWorkActivityLabel(lifestyle.workActivityLevel)}, nên mức vận động nền hằng ngày cũng sẽ ảnh hưởng trực tiếp đến tốc độ cải thiện thể lực.`,
  );

  if (lifestyle.workActivityLevel === "sedentary") {
    lifestyleReview.push(
      "Khách có xu hướng ngồi nhiều, vì vậy ngoài buổi tập nên tăng thêm vận động nền để hỗ trợ trao đổi chất và cải thiện thể trạng tổng thể.",
    );
  }

  const nutrition = [];

  if (mealsPerDay > 0) {
    nutrition.push(
      mealsPerDay <= 2
        ? `Khách hiện chỉ ăn khoảng ${mealsPerDay} bữa/ngày. Tần suất này khá thấp, nên nếu kéo dài sẽ dễ ảnh hưởng đến năng lượng tập luyện và khả năng hồi phục.`
        : `Khách hiện ăn khoảng ${mealsPerDay} bữa/ngày, đây là một nền tương đối ổn để tiếp tục điều chỉnh theo mục tiêu ${goalLabel}.`,
    );
  }

  nutrition.push(
    lifestyle.usuallyEatOut
      ? "Khách ăn ngoài khá thường xuyên, vì vậy PT nên theo dõi kỹ hơn độ ổn định của khẩu phần và chất lượng dinh dưỡng thực tế."
      : "Khách không ăn ngoài quá thường xuyên, đây là một lợi thế khi muốn kiểm soát dinh dưỡng sát mục tiêu hơn.",
  );

  nutrition.push(
    lifestyle.drinkEnoughWater
      ? "Chúng ta thấy khách uống nước tương đối đủ, đây là một nền khá tốt cho hiệu suất tập luyện và khả năng hồi phục."
      : "Lượng nước hiện tại của khách vẫn chưa thật sự tốt. Nếu không cải thiện, hiệu suất tập luyện và hồi phục đều có thể bị ảnh hưởng.",
  );

  if (
    lifestyle.foodAllergies &&
    lifestyle.foodAllergies.trim().toLowerCase() !== "không"
  ) {
    nutrition.push(
      `Cần lưu ý thêm về dị ứng hoặc hạn chế thực phẩm: ${lifestyle.foodAllergies}.`,
    );
  } else {
    nutrition.push(
      "Khách hàng hiện không có dị ứng hay hạn chế thực phẩm đáng chú ý, đây là một lợi thế khi xây dựng định hướng dinh dưỡng ban đầu.",
    );
  }
  const riskFactors = [];
  const bodyFatComment = buildBodyFatComment(gender, bodyFat);
  if (bodyFatComment) riskFactors.push(bodyFatComment);

  if (restingHr >= 85) {
    riskFactors.push(
      `Nhịp tim nghỉ khoảng ${restingHr} bpm đang khá cao, cho thấy nền tim mạch hoặc khả năng hồi phục hiện tại chưa thật sự tốt.`,
    );
  }

  if (sleepHours > 0 && sleepHours < 6) {
    riskFactors.push(
      "Ngủ chưa đủ là một yếu tố dễ làm chậm hồi phục và khiến tiến độ tập luyện thiếu ổn định.",
    );
  }

  if (stressLevel === "high") {
    riskFactors.push(
      "Stress cao có thể làm giảm khả năng hồi phục và mức độ bám giáo án, nên PT cần kiểm soát nhịp tăng tải hợp lý.",
    );
  }

  if (mealsPerDay > 0 && mealsPerDay <= 2) {
    riskFactors.push(
      "Tần suất ăn thấp có thể khiến khách thiếu năng lượng cho tập luyện và khó duy trì hồi phục tốt, nhất là khi mục tiêu là cải thiện body composition hoặc tăng cơ.",
    );
  }

  if (!lifestyle.drinkEnoughWater) {
    riskFactors.push(
      "Uống nước chưa đủ là một rủi ro nền dễ bị bỏ qua nhưng vẫn ảnh hưởng rõ đến hiệu suất tập và hồi phục.",
    );
  }

  if (
    healthScreening.currentConditions ||
    healthScreening.doctorRestrictions ||
    warningSigns.length
  ) {
    riskFactors.push(
      "Những yếu tố sức khỏe ghi nhận từ intake khiến PT cần theo dõi phản ứng buổi đầu kỹ hơn bình thường.",
    );
  }

  if (!riskFactors.length) {
    riskFactors.push(
      "Hiện tại chưa thấy yếu tố rủi ro nổi bật ở mức cần cảnh báo mạnh, nhưng PT vẫn nên theo dõi phản ứng thực tế của khách trong 2 tuần đầu.",
    );
  }

  const postureScore = computePostureChartScore(assessment);
  const strengthScore = computeStrengthChartScore(assessment);
  const enduranceScore = computeEnduranceChartScore(assessment);
  const cardioScore = computeCardioChartScore(assessment);

  const startupPlan = buildStartupPlanByPhase({
    phase: recommendedStartPhase,
    correctiveFocus,
    trainingFocus,
    trainingNotes,
  });

  return {
    quickOverview,
    generalReview: {
      health,
      physical,
      lifestyle: lifestyleReview,
      nutrition,
      riskFactors,
    },
    physicalChart: {
      posture: postureScore,
      strength: strengthScore,
      endurance: enduranceScore,
      cardio: cardioScore,
    },
    startupPlan,
  };
};

export const buildAiReport = ({ customer, intake, assessment }) => {
  const riskFlags = buildRiskFlags(intake);
  const lifestyleFlags = buildLifestyleFlags(intake);
  const compensationFlags = collectCompensations(assessment);
  const { strengthFlags, enduranceFlags, cardioFlags } =
    collectPhysicalFlags(assessment);

  const recommendedStartPhase = determineRecommendedStartPhase({
    customer,
    intake,
    assessment,
    riskFlags,
    compensationFlags,
    strengthFlags,
    enduranceFlags,
    cardioFlags,
  });

  const correctiveFocus = buildCorrectiveFocus(compensationFlags);

  const trainingFocus = buildTrainingFocus({
    phase: recommendedStartPhase,
    primaryGoal: intake?.trainingProfileGoal?.primaryGoal,
    strengthFlags,
    enduranceFlags,
    cardioFlags,
    compensationFlags,
  });

  const trainingNotes = new Set(
    buildTrainingNotes({
      phase: recommendedStartPhase,
      intake,
      riskFlags,
      lifestyleFlags,
      compensationFlags,
      strengthFlags,
      enduranceFlags,
      cardioFlags,
    }),
  );

  return {
    inputSummary: {
      readinessStatus: customer.readinessStatus,
      painFlag: intake?.systemFlags?.painFlag || "none",
      primaryGoal: intake?.trainingProfileGoal?.primaryGoal || "",
      overallPhysicalLevel: assessment?.overallPhysicalLevel || "average",
    },
    findings: {
      riskFlags,
      compensationFlags,
      lifestyleFlags,
      strengthFlags,
      enduranceFlags,
      cardioFlags,
    },
    recommendations: {
      correctiveFocus,
      trainingFocus,
      recommendedStartPhase,
      trainingNotes: Array.from(trainingNotes),
    },
    reportSummary: buildAiReportSummary({
      customer,
      intake,
      assessment,
      riskFlags,
      lifestyleFlags,
      compensationFlags,
      strengthFlags,
      enduranceFlags,
      cardioFlags,
      correctiveFocus,
      trainingFocus,
      trainingNotes,
      recommendedStartPhase,
    }),
    engineVersion: "nasm-rule-engine-v3",
  };
};
