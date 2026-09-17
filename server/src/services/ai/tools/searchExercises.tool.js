// Search Exercises Tool — Query Exercise model từ MongoDB

import Exercise, {
  deriveTechnicalDifficultyRating,
} from "../../../models/Exercise.js";
import { escapeRegex } from "../../../utils/escapeRegex.js";

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
  /\b(?:bai tap|exercise|exercises|workout|workouts|tim|goi y|danh cho|nguoi moi|beginner|beginners|khong can dung cu|khong dung cu|no equipment|without equipment|sets?|reps?|hiep|so lan|kem)\b/;
const NO_EQUIPMENT_PATTERN =
  /\b(?:khong can dung cu|khong dung cu|khong co dung cu|no equipment|without equipment|bodyweight|body weight)\b/;
const BEGINNER_INTENT_PATTERN =
  /\b(?:nguoi moi|moi bat dau|beginner|beginners|newbie|newbies)\b/;
const ADVANCED_EXERCISE_NAME_PATTERN =
  /\b(?:archer|diamond|one arm|one-arm|pistol|plyometric|explosive|handstand|muscle up|muscle-up|dragon flag|planche)\b/;
const BODYWEIGHT_EXERCISE_REGEX =
  "(?:^|[\\s-])(?:bodyweight|push[ -]?up|dip|plank|burpee|mountain climber|crunch|sit[ -]?up)(?:$|[\\s-])";

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

/**
 * Tìm bài tập theo nhóm cơ hoặc tên
 * @param {{ muscleGroup?, searchQuery?, limit? }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function searchExercises(params) {
  const { muscleGroup, searchQuery, limit = 5 } = params;
  const query = {};

  const normalizedSearchQuery = normalizeIntent(searchQuery);
  const beginnerIntent = BEGINNER_INTENT_PATTERN.test(normalizedSearchQuery);
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
    if (NO_EQUIPMENT_PATTERN.test(normalizedSearchQuery)) {
      query.name = { $regex: BODYWEIGHT_EXERCISE_REGEX, $options: "i" };
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

  const resultLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const candidateLimit = beginnerIntent
    ? Math.min(Math.max(resultLimit * 3, 15), 30)
    : resultLimit;
  const candidates = await Exercise.find(query)
    .sort({ name: 1 })
    .limit(candidateLimit)
    .select("name muscleGroup description videoUrl imageUrl technicalDifficulty")
    .lean();
  const exercises = beginnerIntent
    ? candidates
        .map((exercise, index) => ({ exercise, index }))
        .sort((left, right) =>
          getBeginnerRank(left.exercise) - getBeginnerRank(right.exercise) ||
          left.index - right.index,
        )
        .slice(0, resultLimit)
        .map(({ exercise }) => exercise)
    : candidates;

  if (exercises.length === 0) {
    return {
      text: muscleGroup
        ? `Không tìm thấy bài tập nào cho nhóm cơ "${muscleGroup}".`
        : `Không tìm thấy bài tập nào khớp với "${searchQuery}".`,
      uiCard: null,
      meta: { evidenceAvailable: false, resultCount: 0 },
    };
  }

  // Text cho LLM
  const exerciseList = exercises
    .map((e, i) => `${i + 1}. ${e.name} (${e.muscleGroup})${e.description ? ` — ${e.description}` : ""}`)
    .join("\n");

  const text = `Tìm thấy ${exercises.length} bài tập:\n${exerciseList}`;

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
    },
  };

  return {
    text,
    uiCard,
    meta: { evidenceAvailable: true, resultCount: exercises.length },
  };
}
