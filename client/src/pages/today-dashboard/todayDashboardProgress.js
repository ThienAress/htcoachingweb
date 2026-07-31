const EMPTY_LABELS = {
  training: "Không có nhiệm vụ",
  nutrition: "Chưa có thực đơn áp dụng",
  journal: "Chưa có nhiệm vụ nhật ký",
};

export const getSectionProgressPresentation = (summary, section) => {
  if (!Object.hasOwn(EMPTY_LABELS, section)) return null;
  const progress = summary?.moduleProgress?.[section];
  if (!progress) return null;

  const hasTasks = progress.percent !== null;
  return {
    ...progress,
    hasTasks,
    valueLabel: hasTasks
      ? progress.percent + "%"
      : EMPTY_LABELS[section],
  };
};
