import { z } from "zod";

const targetNumber = ({ min, max, integer = false }) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return value;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    (integer ? z.number().int() : z.number()).min(min).max(max),
  );

export const waterMlToLiters = (waterMl) => {
  if (waterMl === "" || waterMl === null || waterMl === undefined) return "";
  const parsed = Number(waterMl);
  return Number.isFinite(parsed) ? parsed / 1000 : "";
};

export const waterLitersToMl = (waterLiters) =>
  Math.round(Number(waterLiters) * 1000);

const waterLitersSchema = targetNumber({ min: 0.25, max: 20 }).refine(
  (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
  "Nước uống phải quy đổi được sang ml nguyên",
);

export const wellnessTargetFormSchema = z.object({
  sleepHours: targetNumber({ min: 1, max: 24 }),
  waterLiters: waterLitersSchema,
  steps: targetNumber({ min: 100, max: 200000, integer: true }),
  note: z.string().max(500),
});

export const targetToFormValues = (target) => ({
  sleepHours: target?.targets?.sleepHours ?? "",
  waterLiters: waterMlToLiters(target?.targets?.waterMl),
  steps: target?.targets?.steps ?? "",
  note: target?.note || "",
});
export const getWellnessTargetSubmitLabel = (target, isPending) => {
  if (isPending) return target ? "Đang cập nhật..." : "Đang lưu...";
  return target ? "Cập nhật mục tiêu" : "Lưu mục tiêu";
};

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

const DEFINITIONS = [
  { key: "sleepHours", label: "Giấc ngủ", unit: "giờ" },
  { key: "waterMl", label: "Nước uống", unit: "lít", scale: 0.001 },
  { key: "steps", label: "Số bước", unit: "bước" },
];

export const buildTargetComparisons = (target, actual = {}) => {
  if (!target?.targets) return [];
  return DEFINITIONS.map((definition) => {
    const targetValue = Number(target.targets[definition.key]);
    const rawActual = actual[definition.key];
    const actualValue =
      rawActual === "" || rawActual === null || rawActual === undefined
        ? null
        : Number(rawActual);
    const hasActual = Number.isFinite(actualValue);
    return {
      ...definition,
      targetValue,
      actualValue: hasActual ? actualValue : null,
      percent: hasActual
        ? Math.min(100, Math.max(0, Math.round((actualValue / targetValue) * 100)))
        : null,
      targetLabel: `${formatNumber(targetValue * (definition.scale || 1))} ${definition.unit}`,
      actualLabel: hasActual
        ? `${formatNumber(actualValue * (definition.scale || 1))} / ${formatNumber(targetValue * (definition.scale || 1))} ${definition.unit}`
        : `Chưa ghi / ${formatNumber(targetValue * (definition.scale || 1))} ${definition.unit}`,
    };
  });
};
