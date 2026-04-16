import F1Intake from "../../models/F1Intake.js";

const WARNING_SIGNS = new Set([
  "chest_pain",
  "dizziness",
  "shortness_of_breath",
  "radiating_pain",
  "balance_loss",
]);

const WARNING_SIGN_LABELS = {
  chest_pain: "Đau ngực",
  dizziness: "Chóng mặt",
  shortness_of_breath: "Khó thở bất thường",
  radiating_pain: "Tê lan",
  balance_loss: "Mất thăng bằng",
};

export const buildBiometrics = (metrics = {}) => {
  const heightCm =
    metrics.heightCm !== "" &&
    metrics.heightCm !== null &&
    metrics.heightCm !== undefined
      ? Number(metrics.heightCm)
      : null;

  const weightKg =
    metrics.weightKg !== "" &&
    metrics.weightKg !== null &&
    metrics.weightKg !== undefined
      ? Number(metrics.weightKg)
      : null;

  const bodyFatPercent =
    metrics.bodyFatPercent !== "" &&
    metrics.bodyFatPercent !== null &&
    metrics.bodyFatPercent !== undefined
      ? Number(metrics.bodyFatPercent)
      : null;

  const waistCm =
    metrics.waistCm !== "" &&
    metrics.waistCm !== null &&
    metrics.waistCm !== undefined
      ? Number(metrics.waistCm)
      : null;

  const hipCm =
    metrics.hipCm !== "" &&
    metrics.hipCm !== null &&
    metrics.hipCm !== undefined
      ? Number(metrics.hipCm)
      : null;

  const restingHeartRate =
    metrics.restingHeartRate !== "" &&
    metrics.restingHeartRate !== null &&
    metrics.restingHeartRate !== undefined
      ? Number(metrics.restingHeartRate)
      : null;

  const heightM = heightCm ? heightCm / 100 : null;

  const bmi =
    heightM && weightKg
      ? Number((weightKg / (heightM * heightM)).toFixed(1))
      : null;

  const waistHipRatio =
    waistCm && hipCm ? Number((waistCm / hipCm).toFixed(2)) : null;

  return {
    heightCm,
    weightKg,
    bodyFatPercent,
    waistCm,
    hipCm,
    restingHeartRate,
    bmi,
    waistHipRatio,
  };
};

export const buildSystemFlags = (payload = {}) => {
  const health = payload.healthScreening || {};
  const training = payload.trainingProfileGoal || {};

  const painLevel = Number(health.painLevel || 0);
  const warningSigns = Array.isArray(health.warningSigns)
    ? health.warningSigns
    : [];

  const normalizedWarningSigns = warningSigns.filter((item) =>
    WARNING_SIGNS.has(item),
  );

  const doctorRestrictionsText = (health.doctorRestrictions || "").trim();
  const currentConditionsText = (health.currentConditions || "").trim();
  const surgeriesText = (health.surgeries || "").trim();
  const breakDurationText = (training.breakDuration || "").trim();

  const hasDoctorRestriction = Boolean(doctorRestrictionsText);
  const hasCurrentConditions = Boolean(currentConditionsText);
  const hasSurgeries = Boolean(surgeriesText);

  const isDetrained =
    !training.currentlyTraining ||
    training.trainingExperience === "none" ||
    training.trainingExperience === "beginner" ||
    Boolean(breakDurationText);

  const holdReasons = [];
  const cautionReasons = [];

  if (normalizedWarningSigns.length > 0) {
    holdReasons.push({
      field: "healthScreening.warningSigns",
      label: "Dấu hiệu cảnh báo",
      values: normalizedWarningSigns.map(
        (item) => WARNING_SIGN_LABELS[item] || item,
      ),
    });
  }

  if (hasDoctorRestriction) {
    holdReasons.push({
      field: "healthScreening.doctorRestrictions",
      label: "Hạn chế vận động do bác sĩ",
      value: doctorRestrictionsText,
    });
  }

  if (painLevel >= 5) {
    cautionReasons.push({
      field: "healthScreening.painLevel",
      label: "Mức độ đau",
      value: String(painLevel),
    });
  }

  if (hasCurrentConditions) {
    cautionReasons.push({
      field: "healthScreening.currentConditions",
      label: "Bệnh lý hiện tại",
      value: currentConditionsText,
    });
  }

  if (hasSurgeries) {
    cautionReasons.push({
      field: "healthScreening.surgeries",
      label: "Phẫu thuật từng có",
      value: surgeriesText,
    });
  }

  if (isDetrained) {
    const detrainedNotes = [];
    if (!training.currentlyTraining) detrainedNotes.push("Hiện tại chưa tập");
    if (training.trainingExperience === "none")
      detrainedNotes.push("Chưa từng tập");
    if (training.trainingExperience === "beginner")
      detrainedNotes.push("Kinh nghiệm mới bắt đầu");
    if (breakDurationText)
      detrainedNotes.push(`Nghỉ tập: ${breakDurationText}`);

    cautionReasons.push({
      field: "trainingProfileGoal",
      label: "Tình trạng detrained / kinh nghiệm thấp",
      values: detrainedNotes,
    });
  }

  let painFlag = "none";
  if (painLevel >= 7) painFlag = "severe";
  else if (painLevel >= 5) painFlag = "moderate";
  else if (painLevel >= 1) painFlag = "mild";

  let medicalReviewFlag = false;
  let readinessStatus = "ready";
  let testPermission = "full_test";
  let recommendedStartPhase = "phase_1";

  if (holdReasons.length > 0) {
    medicalReviewFlag = true;
    readinessStatus = "hold";
    testPermission = "hold_test";
    recommendedStartPhase = "pending_review";
  } else if (
    painLevel >= 5 ||
    hasCurrentConditions ||
    hasSurgeries ||
    isDetrained
  ) {
    medicalReviewFlag = true;
    readinessStatus = "caution";
    testPermission = "modified_test";
  } else if (painLevel >= 1) {
    readinessStatus = "caution";
  }

  return {
    painFlag,
    medicalReviewFlag,
    readinessStatus,
    testPermission,
    recommendedStartPhase,
    holdReasons,
    cautionReasons,
  };
};

export const getNextIntakeVersion = async (customerId) => {
  const latest = await F1Intake.findOne({ customerId })
    .sort({ version: -1 })
    .select("version");
  return latest ? latest.version + 1 : 1;
};

export const getOrCreateDraftIntake = async (customer, userId) => {
  let draft = await F1Intake.findOne({
    customerId: customer._id,
    isLatest: true,
  });

  if (!draft) {
    const version = await getNextIntakeVersion(customer._id);
    draft = await F1Intake.create({
      customerId: customer._id,
      version,
      isLatest: true,
      isDraft: true,
      customerInfo: {
        fullName: customer.fullName,
        age: customer.age,
        gender: customer.gender,
        occupation: customer.occupation,
        phone: customer.phone,
        email: customer.email,
      },
      createdBy: userId,
      updatedBy: userId,
    });
  }

  return draft;
};

export const summarizeMedia = (media) => ({
  frontImageUploaded: media.some((item) => item.type === "posture_front"),
  backImageUploaded: media.some((item) => item.type === "posture_back"),
  sideImageUploaded: media.some((item) => item.type === "posture_side"),
});
