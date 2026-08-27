import { z } from "zod";
import {
  getMonthWeekPeriod,
  getMonthWeekPeriods,
} from "../../utils/vietnamDate";

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

export const getWeeklyPeriodWriteMode = ({ period, currentPeriod }) => {
  if (!period || !currentPeriod) return "closed";
  if (period.startDateKey === currentPeriod.startDateKey) return "current";
  return period.endDateKey < currentPeriod.rangeStartDateKey
    ? "historical"
    : "closed";
};

export const getInitialWeeklyPeriodStart = ({
  dateKey = "",
  monthDateKey,
  today,
}) => {
  const selectedMonth = String(monthDateKey || "").slice(0, 7);
  if (String(dateKey || "").slice(0, 7) === selectedMonth) {
    const requestedPeriod = getMonthWeekPeriod(dateKey);
    if (requestedPeriod) return requestedPeriod.startDateKey;
  }
  if (String(today || "").slice(0, 7) === selectedMonth) {
    return getMonthWeekPeriod(today)?.startDateKey || "";
  }
  return getMonthWeekPeriods(monthDateKey).at(-1)?.startDateKey || "";
};

export const getWeeklySubmittedLockMessage = ({
  periodMode,
  correctionUsed,
}) => {
  if (periodMode === "historical") {
    return "Báo cáo của kỳ đã qua đã được gửi và khóa. Bạn có thể xem lại nhưng không thể cập nhật lần nữa.";
  }
  return correctionUsed
    ? "Báo cáo đã khóa. Bạn đã sử dụng lượt cập nhật duy nhất cho tuần này."
    : "Báo cáo đã gửi và đang được khóa. Bạn còn một lượt cập nhật cho tuần này.";
};

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
