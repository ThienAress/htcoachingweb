import { z } from "zod";

export const WEEKLY_SUBMISSION_FIELDS = [
  { key: "weightKg", label: "Cân nặng" },
  { key: "waistCm", label: "Vòng eo" },
  { key: "bodyFatPercent", label: "Tỷ lệ mỡ cơ thể" },
  { key: "skeletalMusclePercent", label: "Tỷ lệ cơ xương" },
];

const hasSubmittedValue = (value) =>
  value !== "" && value !== null && value !== undefined;

export const getMissingWeeklyFields = (values = {}) =>
  WEEKLY_SUBMISSION_FIELDS.filter(
    ({ key }) => !hasSubmittedValue(values[key]),
  );

const optionalNumber = (min, max, integer = false) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === undefined) return null;
      const numeric = Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    },
    (integer ? z.number().int() : z.number()).min(min).max(max).nullable(),
  );

export const weeklyFormSchema = z.object({
  weightKg: optionalNumber(30, 350),
  waistCm: optionalNumber(30, 300),
  bodyFatPercent: optionalNumber(1, 80),
  skeletalMusclePercent: optionalNumber(1, 80),
});

export const weeklyCheckinSchema = weeklyFormSchema.extend({
  correctionReason: z.string().trim().max(500),
});

export const weeklyFormDefaults = {
  weightKg: "",
  waistCm: "",
  bodyFatPercent: "",
  skeletalMusclePercent: "",
};

export const weeklyValuesToPatch = (values) => ({
  body: {
    weightKg: values.weightKg,
    waistCm: values.waistCm,
    bodyFatPercent: values.bodyFatPercent,
    skeletalMusclePercent: values.skeletalMusclePercent,
  },
});

export const checkinToWeeklyValues = (checkin) =>
  Object.fromEntries(
    Object.entries(weeklyFormDefaults).map(([key]) => [
      key,
      checkin?.body?.[key] === null ||
      checkin?.body?.[key] === undefined
        ? ""
        : String(checkin.body[key]),
    ]),
  );

export const weeklyCheckinPayload = weeklyValuesToPatch;

export const deriveWeeklyCheckinEditState = ({
  checkin,
  canEdit,
  isCorrectionOpen,
  hasChanges = false,
  busy = false,
}) => {
  const submitted = ["submitted", "reviewed"].includes(checkin?.status);
  const correctionUsed = (checkin?.correctionCount || 0) >= 1;
  const correctionOpen =
    submitted && !correctionUsed && Boolean(isCorrectionOpen);

  return {
    submitted,
    correctionUsed,
    correctionOpen,
    fieldsDisabled: busy || !canEdit || (submitted && !correctionOpen),
    canOpenCorrection:
      canEdit && submitted && !correctionUsed && !correctionOpen && !busy,
    canSubmitCorrection: correctionOpen && hasChanges && !busy,
  };
};
