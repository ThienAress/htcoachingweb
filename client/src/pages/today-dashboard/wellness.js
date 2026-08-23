import { z } from "zod";

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

export const WELLNESS_SUBMISSION_FIELDS = [
  { key: "energy", label: "Năng lượng" },
  { key: "hunger", label: "Cảm giác đói" },
  { key: "stress", label: "Căng thẳng" },
  { key: "soreness", label: "Đau mỏi" },
  { key: "pain", label: "Mức đau" },
];

const hasSubmittedValue = (value) =>
  value !== "" && value !== null && value !== undefined;

export const getMissingWellnessFields = (values = {}) =>
  WELLNESS_SUBMISSION_FIELDS.filter(
    ({ key }) => !hasSubmittedValue(values[key]),
  );

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
    )?.label || "Chưa ghi"
  );
};

const optionalNumber = ({ min, max, integer = false }) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      const number = typeof value === "number" ? value : Number(value);
      return Number.isNaN(number) ? value : number;
    },
    (integer ? z.number().int() : z.number())
      .min(min)
      .max(max)
      .nullable(),
  );

export const wellnessFormSchema = z.object({
  sleepHours: optionalNumber({ min: 0, max: 24 }),
  waterMl: optionalNumber({ min: 0, max: 20000, integer: true }),
  steps: optionalNumber({ min: 0, max: 200000, integer: true }),
  energy: optionalNumber({ min: 1, max: 10, integer: true }),
  hunger: optionalNumber({ min: 1, max: 10, integer: true }),
  stress: optionalNumber({ min: 1, max: 10, integer: true }),
  soreness: optionalNumber({ min: 1, max: 10, integer: true }),
  pain: optionalNumber({ min: 0, max: 10, integer: true }),
  painArea: z.string().max(120),
  privateNote: z.string().max(2000),
  sharedNote: z.string().max(2000),
});

export const journalToWellnessValues = (journal) => ({
  sleepHours: journal?.wellness?.sleepHours ?? "",
  waterMl: journal?.wellness?.waterMl ?? "",
  steps: journal?.wellness?.steps ?? "",
  energy: journal?.wellness?.energy ?? "",
  hunger: journal?.wellness?.hunger ?? "",
  stress: journal?.wellness?.stress ?? "",
  soreness: journal?.wellness?.soreness ?? "",
  pain: journal?.wellness?.pain ?? "",
  painArea: journal?.wellness?.painArea || "",
  privateNote: journal?.notes?.private || "",
  sharedNote: journal?.notes?.shared || "",
});

export const wellnessValuesToPatch = (values) => {
  const parsed = wellnessFormSchema.parse(values);
  return {
    wellness: {
      sleepHours: parsed.sleepHours,
      waterMl: parsed.waterMl,
      steps: parsed.steps,
      energy: parsed.energy,
      hunger: parsed.hunger,
      stress: parsed.stress,
      soreness: parsed.soreness,
      pain: parsed.pain,
      painArea: parsed.painArea.trim(),
    },
    notes: {
      private: parsed.privateNote.trim(),
      shared: parsed.sharedNote.trim(),
    },
  };
};
