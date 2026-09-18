const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const NO_EQUIPMENT_CATALOG_SEARCH_SOURCE =
  "(?:body[ -]?weight|push[ -]?up|h[ií]t[ -]?[dđ](?:a|ấ)t|plank|burpee|mountain[ -]?climber|crunch|sit[ -]?up|squat|lunge|glute[ -]?bridge|hip[ -]?bridge|calf[ -]?raise)";
const NO_EQUIPMENT_SAFE_PATTERN = new RegExp(
  `\\b${NO_EQUIPMENT_CATALOG_SEARCH_SOURCE}\\b`,
);
const NO_EQUIPMENT_SETUP_PATTERN =
  /\b(?:bench|ghe|chair|incline|decline|dips?|dip station|barbell|thanh don|xa don|xa kep|pull[ -]?up bars?|trx|suspension trainers?|resistance bands?|day khang luc|dumbbells?|ta don|kettlebells?|cable|cap|machines?|may tap|rings?|parallettes?|plyo box|step platform)\b/;
const EXPLICIT_NO_SETUP_PATTERN =
  /\b(?:khong can|khong dung|khong co|no|without)\s+(?:bench|ghe|chair|bar|xa|trx|band|day khang luc|dumbbell|ta don|machine|may|cable)\b/g;
const ADVANCED_BODYWEIGHT_PATTERN =
  /\b(?:archer|diamond|one arm|one-arm|pistol|plyometric|explosive|handstand|muscle up|muscle-up|dragon flag|planche|plyo|clap)\b/;
const CHEST_MUSCLE_PATTERN =
  /(?:^|\s)(?:nguc|chest|pectoral)(?:$|\s)/;

export const getExerciseCatalogText = (exercise) =>
  normalize([
    exercise?.name,
    exercise?.description,
    ...(Array.isArray(exercise?.instructions)
      ? exercise.instructions.flatMap((instruction) =>
          typeof instruction === "string"
            ? []
            : [instruction?.title, instruction?.description])
      : []),
  ].filter(Boolean).join(" "));

export const isNoEquipmentCompatibleExercise = (exercise) => {
  const text = getExerciseCatalogText(exercise);
  if (!NO_EQUIPMENT_SAFE_PATTERN.test(text)) return false;
  const setupEvidence = text.replace(EXPLICIT_NO_SETUP_PATTERN, "");
  return !NO_EQUIPMENT_SETUP_PATTERN.test(setupEvidence);
};

export const isBeginnerBodyweightChestExercise = (exercise) => {
  const muscleGroup = normalize(exercise?.muscleGroup);
  const text = getExerciseCatalogText(exercise);
  return CHEST_MUSCLE_PATTERN.test(muscleGroup) &&
    isNoEquipmentCompatibleExercise(exercise) &&
    !ADVANCED_BODYWEIGHT_PATTERN.test(text);
};
