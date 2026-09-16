export const DAILY_JOURNAL_SUBMISSION_FIELDS = Object.freeze([
  { key: "energy", path: "wellness.energy" },
  { key: "hunger", path: "wellness.hunger" },
  { key: "stress", path: "wellness.stress" },
  { key: "soreness", path: "wellness.soreness" },
  { key: "pain", path: "wellness.pain" },
]);

export const WEEKLY_CHECKIN_SUBMISSION_FIELDS = Object.freeze([
  { key: "weightKg", path: "body.weightKg" },
  { key: "waistCm", path: "body.waistCm" },
  { key: "hipCm", path: "body.hipCm" },
  { key: "abdomenCm", path: "body.abdomenCm" },
  { key: "bodyFatPercent", path: "body.bodyFatPercent" },
  {
    key: "skeletalMusclePercent",
    path: "body.skeletalMusclePercent",
  },
]);

export const COACHING_SUBMISSION_FIELD_KEYS = Object.freeze([
  ...DAILY_JOURNAL_SUBMISSION_FIELDS.map(({ key }) => key),
  ...WEEKLY_CHECKIN_SUBMISSION_FIELDS.map(({ key }) => key),
]);
