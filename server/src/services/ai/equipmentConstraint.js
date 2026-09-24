const LIMITED_EQUIPMENT_PATTERN = /\b(?:chi co|chi dung|only have|only use|have only)\b/;
const DUMBBELL_PATTERN = /\b(?:ta don|dumbbells?)\b/;
const RESISTANCE_BAND_PATTERN = /\b(?:day khang luc|resistance bands?)\b/;
const BAND_ONLY_PATTERN = /\b(?:chi co|chi dung|only have|only use|have only)\s+(?:(?:mot|1)\s+)?(?:day khang luc|resistance bands?)\b/;
const FORBIDDEN_EQUIPMENT_PATTERN =
  /\b(?:barbell|thanh don|cable|cap|machine|may tap|smith|bench press|ghe tap|incline press|decline press|pec deck|lat pulldown|leg press|xa don|pull[ -]?up bars?|pull[ -]?ups?|chin[ -]?ups?|keo xa|trx|suspension trainers?|kettlebells?|chair|ghe|plyo box|box jumps?|dip stations?|dips?)\b/;
const DUMBBELL_PRESS_PATTERN =
  /\b(?:dumbbells?|ta don)\b[^\n]{0,50}\b(?:press|day nguc)\b|\b(?:press|day nguc)\b[^\n]{0,50}\b(?:dumbbells?|ta don)\b/;
const SAFE_PRESS_VARIANT_PATTERN =
  /\b(?:floor|san|standing|dung|overhead|shoulder|vai|resistance bands?|day khang luc)\b/;
const NEGATED_EQUIPMENT_PATTERN =
  /\b(?:khong|ko|tranh|loai bo|without|avoid|no)\b[^\n.;:]{0,35}\b(?:barbell|thanh don|cable|cap|machine|may tap|smith|bench|ghe|xa don|pull[ -]?up bars?|pull[ -]?ups?|chin[ -]?ups?|keo xa|trx|suspension trainers?|kettlebells?|chair|plyo box|box jumps?|dip stations?|dips?)\b/g;

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s.,;:\n-]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

export const hasLimitedDumbbellBandConstraint = (message) => {
  const normalized = normalize(message);
  return LIMITED_EQUIPMENT_PATTERN.test(normalized) &&
    DUMBBELL_PATTERN.test(normalized) &&
    RESISTANCE_BAND_PATTERN.test(normalized);
};

export const hasBandOnlyConstraint = (message) =>
  BAND_ONLY_PATTERN.test(normalize(message)) && !DUMBBELL_PATTERN.test(normalize(message));

export const validateWorkoutEquipmentOutput = (message, answer) => {
  const bandOnly = hasBandOnlyConstraint(message);
  if (!hasLimitedDumbbellBandConstraint(message) && !bandOnly) {
    return Object.freeze({ applies: false, valid: true, reasonCodes: [] });
  }

  const violations = new Set();
  for (const rawLine of normalize(answer).split("\n")) {
    const line = rawLine.replace(NEGATED_EQUIPMENT_PATTERN, " ");
    if (FORBIDDEN_EQUIPMENT_PATTERN.test(line) || (bandOnly && DUMBBELL_PATTERN.test(line))) {
      violations.add("unsupported_equipment");
    }
    if (
      DUMBBELL_PRESS_PATTERN.test(line) &&
      !SAFE_PRESS_VARIANT_PATTERN.test(line)
    ) {
      violations.add("ambiguous_dumbbell_press_setup");
    }
  }

  return Object.freeze({
    applies: true,
    valid: violations.size === 0,
    reasonCodes: Object.freeze([...violations]),
  });
};
