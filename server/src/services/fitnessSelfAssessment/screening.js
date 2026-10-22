import { WARNING_SIGNS, WARNING_SIGN_LABELS } from "./constants.js";

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Luật sàng lọc tương đương buildSystemFlags của F1 (có test đối chiếu), nhưng độc lập để không phụ thuộc controller HLV.
// Khách tự tập không có HLV duyệt: kết quả chỉ để khóa/giảm bài test và đưa lời khuyên.
export const buildSelfScreening = ({ screening = {}, training = {} } = {}) => {
  const painLevel = Number(screening.painLevel || 0);
  const warningSigns = (Array.isArray(screening.warningSigns) ? screening.warningSigns : []).filter(
    (item) => WARNING_SIGNS.includes(item),
  );
  const doctorRestrictions = text(screening.doctorRestrictions);
  const currentConditions = text(screening.currentConditions);
  const surgeries = text(screening.surgeries);
  const breakDuration = text(training.breakDuration);

  const isDetrained =
    !training.currentlyTraining ||
    training.trainingExperience === "none" ||
    training.trainingExperience === "beginner" ||
    Boolean(breakDuration);

  const holdReasons = [];
  const cautionReasons = [];

  if (warningSigns.length > 0) {
    holdReasons.push({
      field: "screening.warningSigns",
      label: "Dấu hiệu cảnh báo",
      values: warningSigns.map((item) => WARNING_SIGN_LABELS[item] || item),
    });
  }
  if (doctorRestrictions) {
    holdReasons.push({
      field: "screening.doctorRestrictions",
      label: "Hạn chế vận động do bác sĩ",
      value: doctorRestrictions,
    });
  }
  if (painLevel >= 5) {
    cautionReasons.push({ field: "screening.painLevel", label: "Mức độ đau", value: String(painLevel) });
  }
  if (currentConditions) {
    cautionReasons.push({
      field: "screening.currentConditions",
      label: "Bệnh lý hiện tại",
      value: currentConditions,
    });
  }
  if (surgeries) {
    cautionReasons.push({ field: "screening.surgeries", label: "Phẫu thuật từng có", value: surgeries });
  }
  if (isDetrained) {
    const notes = [];
    if (!training.currentlyTraining) notes.push("Hiện tại chưa tập");
    if (training.trainingExperience === "none") notes.push("Chưa từng tập");
    if (training.trainingExperience === "beginner") notes.push("Kinh nghiệm mới bắt đầu");
    if (breakDuration) notes.push(`Nghỉ tập: ${breakDuration}`);
    cautionReasons.push({
      field: "training",
      label: "Đã lâu không tập hoặc kinh nghiệm thấp",
      values: notes,
    });
  }

  let painFlag = "none";
  if (painLevel >= 7) painFlag = "severe";
  else if (painLevel >= 5) painFlag = "moderate";
  else if (painLevel >= 1) painFlag = "mild";

  let medicalReviewFlag = false;
  let testPermission = "full_test";
  let recommendedStartPhase = "phase_1";

  if (holdReasons.length > 0) {
    medicalReviewFlag = true;
    testPermission = "hold_test";
    recommendedStartPhase = "pending_review";
  } else if (painLevel >= 5 || currentConditions || surgeries || isDetrained) {
    medicalReviewFlag = true;
    testPermission = "modified_test";
  }

  return {
    painFlag,
    medicalReviewFlag,
    testPermission,
    recommendedStartPhase,
    holdReasons,
    cautionReasons,
  };
};
