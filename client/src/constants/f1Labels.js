export const F1_GENDER_LABELS = Object.freeze({
  male: "Nam",
  female: "Nữ",
  other: "Khác",
});

export const getF1GenderLabel = (value) => F1_GENDER_LABELS[value] || value || "";
