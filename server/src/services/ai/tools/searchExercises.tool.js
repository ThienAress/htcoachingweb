// Search Exercises Tool — Query Exercise model từ MongoDB

import Exercise, {
  deriveTechnicalDifficultyRating,
} from "../../../models/Exercise.js";
import { escapeRegex } from "../../../utils/escapeRegex.js";
import { validateWorkoutEquipmentOutput } from "../equipmentConstraint.js";
import {
  getExerciseCatalogText,
  isNoEquipmentCompatibleExercise,
  NO_EQUIPMENT_CATALOG_SEARCH_SOURCE,
} from "../exerciseCatalogCompatibility.js";

const MUSCLE_GROUP_ALIASES = [
  {
    keys: ["nguc", "chest", "pec", "pecs", "pectoral", "pectorals"],
    values: ["Ngực", "nguc", "chest", "pecs?", "pectorals?"],
  },
  {
    keys: ["lung", "back", "lat", "lats"],
    values: ["Lưng", "lung", "back", "lats?"],
  },
  {
    keys: ["chan", "dui", "legs", "leg", "quad", "quads", "hamstring", "hamstrings", "glute", "glutes"],
    values: ["Chân", "chan", "Đùi", "dui", "legs?", "quads?", "hamstrings?", "glutes?"],
  },
  {
    keys: ["vai", "shoulder", "shoulders", "delt", "delts"],
    values: ["Vai", "shoulders?", "delts?"],
  },
  {
    keys: ["tay", "arms", "arm", "biceps", "triceps"],
    values: ["Tay", "arms?", "biceps", "triceps"],
  },
  {
    keys: ["bung", "eo", "abs", "abdominal", "core"],
    values: ["Bụng", "bung", "Eo", "abs", "abdominal", "core"],
  },
];

const GENERIC_EXERCISE_INTENT_PATTERN =
  /\b(?:bai tap|exercise|exercises|workout|workouts|workout plan|training plan|lich tap|chuong trinh tap|giao an tap|tim|goi y|danh cho|nguoi moi|beginner|beginners|khong can dung cu|khong dung cu|no equipment|without equipment|sets?|reps?|hiep|so lan|kem)\b/;
const NO_EQUIPMENT_PATTERN =
  /\b(?:khong can dung cu|khong dung cu|khong co dung cu|no equipment|without equipment|bodyweight|body weight)\b/;
const BEGINNER_INTENT_PATTERN =
  /\b(?:nguoi moi|moi bat dau|beginner|beginners|newbie|newbies)\b/;
const ADVANCED_EXERCISE_NAME_PATTERN =
  /\b(?:archer|diamond|one arm|one-arm|pistol|plyometric|explosive|handstand|muscle up|muscle-up|dragon flag|planche)\b/;
const NO_EQUIPMENT_CATALOG_FIELDS = Object.freeze([
  "name",
  "description",
  "instructions.title",
  "instructions.description",
]);
const LIMITED_EQUIPMENT_INTENT_PATTERN =
  /\b(?:chi co|chi dung|only have|only use|have only)\b/;
const DUMBBELL_PATTERN = /\b(?:ta don|dumbbells?)\b/;
const RESISTANCE_BAND_PATTERN = /\b(?:day khang luc|resistance bands?)\b/;
const EXPLICITLY_UNAVAILABLE_EQUIPMENT_PATTERN =
  /\b(?:barbell|thanh don|cable|cap|machine|may|xa don|pull[ -]?up bars?|pull[ -]?ups?|chin[ -]?ups?|keo xa|trx|suspension trainers?|kettlebells?|plyo box|box jumps?|dip stations?|dips?)\b/;
const BENCH_REQUIRED_PATTERN = /\b(?:bench|ghe)\b/;
const FLOOR_COMPATIBLE_PATTERN =
  /\b(?:floor|san|khong can ghe|no bench|without bench)\b/;
const LIMITED_EQUIPMENT_SAFE_PATTERN =
  /\b(?:dumbbells?|ta don|resistance bands?|day khang luc|bodyweight|push[ -]?up|hit dat|plank|burpee|mountain climber|crunch|sit[ -]?up|squat|lunge|calf raise)\b/;
const DISPLACED_STAGING_NAME_PATTERN = /^__plan079_displaced__/i;
const MAX_FILTERED_CANDIDATES = 100;

const normalizeIntent = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findMuscleGroupAlias = (...values) => {
  const normalized = normalizeIntent(values.filter(Boolean).join(" "));
  return MUSCLE_GROUP_ALIASES.find(({ keys }) =>
    keys.some((key) => new RegExp(`(?:^|\\s)${escapeRegex(key)}(?:$|\\s)`).test(normalized)),
  );
};

const buildMuscleGroupRegex = (alias, fallback) => {
  if (!alias) return escapeRegex(fallback, 50);
  const alternatives = alias.values.map((value) =>
    value.endsWith("?") ? value : escapeRegex(value, 30),
  );
  return `(?:^|[\\s/,-])(?:${alternatives.join("|")})(?:$|[\\s/,-])`;
};

const getBeginnerRank = (exercise) => {
  const rating = deriveTechnicalDifficultyRating(exercise.technicalDifficulty);
  const advancedPenalty = ADVANCED_EXERCISE_NAME_PATTERN.test(
    normalizeIntent(exercise.name),
  ) ? 10 : 0;
  return advancedPenalty + (rating ?? 3);
};

const hasLimitedDumbbellAndBandConstraint = (normalizedSearchQuery) =>
  LIMITED_EQUIPMENT_INTENT_PATTERN.test(normalizedSearchQuery) &&
  DUMBBELL_PATTERN.test(normalizedSearchQuery) &&
  RESISTANCE_BAND_PATTERN.test(normalizedSearchQuery);

const isCompatibleWithLimitedDumbbellAndBandEquipment = (
  exercise,
  normalizedSearchQuery,
) => {
  const equipmentText = getExerciseCatalogText(exercise);
  if (EXPLICITLY_UNAVAILABLE_EQUIPMENT_PATTERN.test(equipmentText)) return false;
  if (
    BENCH_REQUIRED_PATTERN.test(equipmentText) &&
    !FLOOR_COMPATIBLE_PATTERN.test(equipmentText)
  ) {
    return false;
  }
  return LIMITED_EQUIPMENT_SAFE_PATTERN.test(equipmentText) &&
    validateWorkoutEquipmentOutput(
      normalizedSearchQuery,
      equipmentText,
    ).valid;
};

const isDisplacedStagingExercise = (exercise) =>
  Boolean(exercise?._stagingSearchIndexCohortDisplaced) ||
  DISPLACED_STAGING_NAME_PATTERN.test(String(exercise?.name || ""));

const deduplicateExercisesByName = (exercises) => {
  const names = new Set();
  return exercises.filter((exercise) => {
    const normalizedName = normalizeIntent(exercise?.name);
    if (!normalizedName || names.has(normalizedName)) return false;
    names.add(normalizedName);
    return true;
  });
};

/**
 * Tìm bài tập theo nhóm cơ hoặc tên
 * @param {{ muscleGroup?, searchQuery?, limit? }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function searchExercises(params) {
  const { muscleGroup, searchQuery, limit = 5 } = params;
  const query = {};

  const normalizedSearchQuery = normalizeIntent(searchQuery);
  const noEquipmentIntent = NO_EQUIPMENT_PATTERN.test(normalizedSearchQuery);
  const beginnerIntent = BEGINNER_INTENT_PATTERN.test(normalizedSearchQuery);
  const limitedDumbbellAndBandEquipment = hasLimitedDumbbellAndBandConstraint(
    normalizedSearchQuery,
  );
  const muscleAlias = findMuscleGroupAlias(muscleGroup, searchQuery);
  const normalizedMuscleGroup = normalizeIntent(muscleGroup);
  const searchIsOnlyMuscleGroup = Boolean(
    muscleAlias && normalizedSearchQuery &&
    muscleAlias.keys.some((key) =>
      normalizedSearchQuery === key || normalizedSearchQuery === `co ${key}`,
    ),
  );

  if (muscleGroup || muscleAlias) {
    query.muscleGroup = {
      $regex: buildMuscleGroupRegex(
        muscleAlias,
        normalizedMuscleGroup || muscleGroup,
      ),
      $options: "i",
    };
  }
  if (searchQuery) {
    if (noEquipmentIntent) {
      query.$or = NO_EQUIPMENT_CATALOG_FIELDS.map((field) => ({
        [field]: {
          $regex: NO_EQUIPMENT_CATALOG_SEARCH_SOURCE,
          $options: "i",
        },
      }));
    } else if (
      !GENERIC_EXERCISE_INTENT_PATTERN.test(normalizedSearchQuery) &&
      !searchIsOnlyMuscleGroup
    ) {
      query.name = {
        $regex: escapeRegex(searchQuery, 100),
        $options: "i",
      };
    }
  }

  query.$and = [
    { _stagingSearchIndexCohortDisplaced: { $exists: false } },
    { name: { $not: DISPLACED_STAGING_NAME_PATTERN } },
  ];

  const resultLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const candidateLimit = noEquipmentIntent || limitedDumbbellAndBandEquipment || beginnerIntent
    ? MAX_FILTERED_CANDIDATES
      : Math.min(
          Math.max(resultLimit * 3, 15),
          MAX_FILTERED_CANDIDATES,
        );
  const rawScan = await Exercise.find(query)
    .sort({ name: 1 })
    .limit(candidateLimit + 1)
    .select("name muscleGroup description instructions videoUrl imageUrl technicalDifficulty _stagingSearchIndexCohortDisplaced")
    .lean();
  const scanTruncated = rawScan.length > candidateLimit;
  const rawCandidates = rawScan.slice(0, candidateLimit);
  const candidates = deduplicateExercisesByName(
    rawCandidates.filter((exercise) => !isDisplacedStagingExercise(exercise)),
  );
  const equipmentCompatibleCandidates = noEquipmentIntent
    ? candidates.filter(isNoEquipmentCompatibleExercise)
    : limitedDumbbellAndBandEquipment
      ? candidates.filter((exercise) =>
        isCompatibleWithLimitedDumbbellAndBandEquipment(
          exercise,
          normalizedSearchQuery,
        ))
      : candidates;
  const exercises = beginnerIntent
    ? equipmentCompatibleCandidates
        .map((exercise, index) => ({ exercise, index }))
        .sort((left, right) =>
          getBeginnerRank(left.exercise) - getBeginnerRank(right.exercise) ||
          left.index - right.index,
        )
        .slice(0, resultLimit)
        .map(({ exercise }) => exercise)
    : equipmentCompatibleCandidates.slice(0, resultLimit);
  const excludedForEquipmentCount = candidates.length - equipmentCompatibleCandidates.length;
  const scanIncomplete = scanTruncated && exercises.length < resultLimit;
  const catalogInsufficient = exercises.length < resultLimit && !scanIncomplete;

  if (exercises.length === 0) {
    return {
      text: scanIncomplete
        ? "Chưa tìm đủ bài phù hợp trong giới hạn quét an toàn và chưa quét hết thư viện. Bạn hãy thu hẹp nhóm cơ hoặc tiêu chí để thử lại."
        : muscleGroup
          ? `Không tìm thấy bài tập nào cho nhóm cơ "${muscleGroup}".`
          : `Không tìm thấy bài tập nào khớp với "${searchQuery}".`,
      uiCard: null,
      meta: {
        evidenceAvailable: false,
        requestedCount: resultLimit,
        resultCount: 0,
        catalogInsufficient,
        scanIncomplete,
        equipmentConstraintApplied:
          noEquipmentIntent || limitedDumbbellAndBandEquipment,
        excludedForEquipmentCount,
      },
    };
  }

  // Text cho LLM
  const exerciseList = exercises
    .map((e, i) => `${i + 1}. ${e.name} (${e.muscleGroup})${e.description ? ` — ${e.description}` : ""}`)
    .join("\n");

  const availabilityNotice = catalogInsufficient
    ? `\n\nThư viện hiện chỉ có ${exercises.length}/${resultLimit} bài phù hợp với bộ lọc và thiết bị bạn đã nêu.`
    : scanIncomplete
      ? "\n\nKết quả chưa đủ và chưa quét hết thư viện trong giới hạn an toàn; hãy thu hẹp tiêu chí để tìm chính xác hơn."
      : "";
  const text = `Tìm thấy ${exercises.length} bài tập:\n${exerciseList}${availabilityNotice}`;

  // Structured data cho FE render card
  const uiCard = {
    cardType: "exercise",
    data: {
      exercises: exercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        description: e.description || "",
        videoUrl: e.videoUrl || "",
        imageUrl: e.imageUrl || "",
      })),
      searchedFor: muscleGroup || searchQuery || "tất cả",
      requestedCount: resultLimit,
      resultCount: exercises.length,
      catalogInsufficient,
      scanIncomplete,
    },
  };

  return {
    text,
    uiCard,
    meta: {
      evidenceAvailable: true,
      requestedCount: resultLimit,
      resultCount: exercises.length,
      catalogInsufficient,
      scanIncomplete,
      equipmentConstraintApplied:
        noEquipmentIntent || limitedDumbbellAndBandEquipment,
      excludedForEquipmentCount,
    },
  };
}
