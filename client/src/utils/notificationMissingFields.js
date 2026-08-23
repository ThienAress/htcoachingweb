const MISSING_FIELD_LABELS = {
  energy: "Năng lượng",
  hunger: "Cảm giác đói",
  stress: "Căng thẳng",
  soreness: "Đau mỏi",
  pain: "Mức đau",
  weightKg: "Cân nặng",
  waistCm: "Vòng eo",
  bodyFatPercent: "Tỷ lệ mỡ cơ thể",
  skeletalMusclePercent: "Tỷ lệ cơ xương",
};

export const notificationMissingFieldsLabel = (missingFields = []) => {
  const labels = [...new Set(missingFields)]
    .map((key) => MISSING_FIELD_LABELS[key])
    .filter(Boolean);
  return labels.length > 0 ? `Chưa nhập: ${labels.join(", ")}` : "";
};
