export const WELLNESS_SEMANTIC_OPTIONS = {
  energy: [
    { value: 3, label: "Cạn kiệt" },
    { value: 6, label: "Bình thường" },
    { value: 9, label: "Rất sung sức" },
  ],
  hunger: [
    { value: 3, label: "Ít đói" },
    { value: 6, label: "Đói vừa" },
    { value: 9, label: "Rất đói" },
  ],
  stress: [
    { value: 3, label: "Thư giãn" },
    { value: 6, label: "Căng thẳng vừa" },
    { value: 9, label: "Rất căng thẳng" },
  ],
  soreness: [
    { value: 3, label: "Không đáng kể" },
    { value: 6, label: "Đau mỏi vừa" },
    { value: 9, label: "Rất đau mỏi" },
  ],
  pain: [
    { value: 0, label: "Không đau" },
    { value: 6, label: "Đau vừa" },
    { value: 9, label: "Đau nhiều" },
  ],
};

export const wellnessSemanticValue = (field, value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (field === "pain" && number === 0) return 0;
  if (number <= 4) return field === "pain" ? 0 : 3;
  if (number <= 7) return 6;
  return 9;
};

export const wellnessSemanticLabel = (field, value) => {
  const semanticValue = wellnessSemanticValue(field, value);
  return (
    WELLNESS_SEMANTIC_OPTIONS[field]?.find(
      (option) => option.value === semanticValue,
    )?.label || "Chưa chọn"
  );
};
