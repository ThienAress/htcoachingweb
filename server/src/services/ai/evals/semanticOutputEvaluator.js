import { validateWorkoutEquipmentOutput } from "../equipmentConstraint.js";
import { evaluateMealNumeric } from "./semanticMealOutputEvaluator.js";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value, name) => {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
};

const findCard = (output, cardType) =>
  asArray(output.cards || [], "output.cards").find(
    (card) => (card?.cardType || card?.type) === cardType,
  );

const cardData = (output, cardType) => findCard(output, cardType)?.data;

const observedText = (output) => String(
  output.text ?? output.assistantMessage?.content ?? "",
);

const observedTrace = (output) =>
  output.trace ?? output.assistantMessage?.answerTrace ?? {};

const evaluateExerciseCard = (output, rule, failures) => {
  const card = cardData(output, "exercise");
  if (!isPlainObject(card)) {
    failures.push("exercise card is missing");
    return;
  }
  const exercises = asArray(card.exercises, "exercise.exercises");
  if (exercises.length !== rule.requestedCount) {
    failures.push(`exercise count ${exercises.length} did not match requested ${rule.requestedCount}`);
  }
  if (card.catalogInsufficient === true) {
    failures.push("exercise catalog reported insufficient compatible results");
  }
  const exerciseText = exercises
    .map((exercise) => `${exercise?.name || ""} ${exercise?.description || ""}`)
    .join(" ")
    .toLocaleLowerCase("vi");
  for (const forbidden of asArray(rule.forbiddenTerms || [], "exercise_card.forbiddenTerms")) {
    if (exerciseText.includes(String(forbidden).toLocaleLowerCase("vi"))) {
      failures.push(`exercise card contained forbidden equipment term: ${forbidden}`);
    }
  }
};

const dayNumbersFromText = (text) => {
  const days = new Set();
  for (const match of text.matchAll(/\b(?:ngày|buổi)\s*((?:\d+\s*(?:[,&/-]|và)?\s*)+)/gi)) {
    for (const value of match[1].match(/\d+/g) || []) days.add(Number(value));
  }
  return days;
};

const daySectionsFromText = (text) => {
  const matches = [...String(text || "").matchAll(/\b(?:ngày|buổi)\s*(\d+)\s*:?/gi)];
  return matches.map((match, index) => ({
    day: Number(match[1]),
    text: String(text).slice(
      match.index,
      matches[index + 1]?.index ?? String(text).length,
    ),
  }));
};

const markdownUrls = (text) => [
  ...String(text || "").matchAll(/\[[^\]]+\]\((?:<(https:\/\/[^\s<>]+)>|(https:\/\/[^\s)]+))\)/gi),
].map((match) => match[1] || match[2]);

const numberedQuestionCount = (text) => {
  const numbered = new Set();
  for (const match of String(text || "").matchAll(/(?:^|\n)\s*(\d{1,2})[.)]\s+/g)) {
    numbered.add(Number(match[1]));
  }
  return numbered.size || (String(text || "").includes("?") ? 1 : 0);
};

const evaluateWorkoutStructure = (output, rule, failures) => {
  const text = observedText(output);
  if (dayNumbersFromText(text).size < rule.minDays) {
    failures.push(`workout structure needs at least ${rule.minDays} distinct days`);
  }
  if (!/hiệp/i.test(text) || !/(?:lần|reps?)/i.test(text) || !/RPE/i.test(text) || !/nghỉ/i.test(text)) {
    failures.push("workout structure is missing sets, reps, RPE, or rest");
  }
  if (rule.request && !validateWorkoutEquipmentOutput(rule.request, text).valid) {
    failures.push("workout uses equipment outside the explicit user constraint");
  }
  if (rule.requireDeload === true &&
      (/còn\s+30%/i.test(text) || !/giảm khoảng 30%/i.test(text))) {
    failures.push("workout deload wording must say giảm khoảng 30%");
  }
};

const evaluators = {
  meal_numeric: evaluateMealNumeric,
  exercise_card: evaluateExerciseCard,
  workout_structure: evaluateWorkoutStructure,
  no_flat_exercise_card: (output, _rule, failures) => {
    if (findCard(output, "exercise")) {
      failures.push("flat exercise card cannot represent a workout plan");
    }
  },
  preserve_scope: (output, rule, failures) => {
    const text = observedText(output);
    const normalized = text.toLocaleLowerCase("vi");
    const nonNegatedWorkoutText = text.replace(
      /(?:không|chưa)\s+(?:tự\s+)?(?:giảm|tăng|đổi|thay(?:\s+đổi)?)\b[^.!?;,\n]{0,35}(?:lịch tập|khối lượng tập|volume|số buổi)/giu,
      "",
    );
    if (rule.changedValue && !normalized.includes(String(rule.changedValue).toLocaleLowerCase("vi"))) {
      failures.push(`scope response omitted the requested value: ${rule.changedValue}`);
    }
    if (!/(?:chỉ|duy nhất)[^.!?\n]{0,80}(?:thay đổi|đổi)|(?:mọi|toàn bộ)[^.!?\n]{0,80}(?:giữ nguyên|không đổi)/iu.test(text)) {
      failures.push("scope response did not explicitly preserve the locked plan");
    }
    if (/(?:giảm|tăng|đổi|thay)[^.!?;,\n]{0,35}(?:lịch tập|khối lượng tập|volume|số buổi)/iu.test(nonNegatedWorkoutText) &&
        !/(?:bạn có muốn|nếu bạn đồng ý|xin phép|có muốn mình)/iu.test(text)) {
      failures.push("coaching advisory changed the requested plan without permission");
    }
  },
  seven_day_coverage: (output, rule, failures) => {
    const text = observedText(output);
    const days = dayNumbersFromText(text);
    if ([1, 2, 3, 4, 5, 6, 7].some((day) => !days.has(day))) {
      failures.push("seven-day coverage is missing");
    }
    if (rule.requireMealAndTraining === true) {
      const sections = daySectionsFromText(text);
      const completeDays = new Set(
        sections
          .filter(({ text: section }) =>
            /(?:ăn|bữa|thực đơn|dinh dưỡng)/iu.test(section) &&
            /(?:tập|đi bộ|cardio|phục hồi|nghỉ)/iu.test(section))
          .map(({ day }) => day),
      );
      if ([1, 2, 3, 4, 5, 6, 7].some((day) => !completeDays.has(day))) {
        failures.push("seven-day plan is missing meal or training detail for at least one day");
      }
    }
  },
  retry_continuity: (output, rule, failures) => {
    const trace = observedTrace(output);
    if (trace.conversationId !== rule.conversationId ||
        trace.retryConversationId !== rule.conversationId ||
        trace.turnId !== rule.turnId ||
        trace.retryTurnId !== rule.turnId) {
      failures.push("retry continuity changed conversation or turn metadata");
    }
  },
  meal_safety_price: (output, rule, failures) => {
    const meal = cardData(output, "meal");
    const safety = meal?.safety;
    const ingredientLimited = safety?.status === "ingredient_verified" &&
      safety?.crossContactStatus === "product_label_required";
    if (!["verified", "ingredient_verified"].includes(safety?.status) ||
        safety?.allergenConstraintsApplied !== true) {
      failures.push("meal allergy constraint was not checked");
    }
    if (rule.requirePackageLabelSafety === true && safety?.status !== "verified") {
      failures.push("meal allergy constraint requires package-label verification");
    }
    if (ingredientLimited &&
        (!String(safety?.warning || "").trim() ||
          !observedText(output).includes(String(safety.warning)))) {
      failures.push("ingredient-level allergen evidence lacks a visible product-label warning");
    }
    if (rule.priceRequired === true && meal?.price?.status !== "verified") {
      failures.push("meal price lacks verified provenance");
    }
  },
  scoped_meal_adjustment: (output, rule, failures) => {
    const adjustments = cardData(output, "meal")?.adjustments;
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      failures.push("scoped meal adjustments are missing");
      return;
    }
    const allowedIds = new Set(asArray(rule.allowedFoodIds || [], "scoped_meal_adjustment.allowedFoodIds"));
    const allowedNames = new Set(asArray(rule.allowedFoodNames || [], "scoped_meal_adjustment.allowedFoodNames"));
    const unauthorized = adjustments.filter((item) =>
      !allowedIds.has(String(item?.foodId || "")) && !allowedNames.has(String(item?.name || "")),
    );
    if (unauthorized.length) failures.push("scoped meal adjustment changed an unauthorized food");
  },
  web_search: (output, _rule, failures) => {
    const sources = markdownUrls(observedText(output));
    if (observedTrace(output).webSearchOutcome !== "grounded" ||
        !sources.some((source) => /^https:\/\//.test(source))) {
      failures.push("web search was not grounded by a supported source");
    }
  },
  intake_questions: (output, rule, failures) => {
    const text = observedText(output);
    const questionCount = numberedQuestionCount(text);
    if (questionCount < 1 || questionCount > 5) {
      failures.push("intake question count must be between 1 and 5");
    }
    if (!/ước tính/i.test(text)) {
      failures.push("TDEE must be framed as an estimate");
    }
    if (rule.requestType === "workout" &&
        (!/(?:kinh nghiệm|trình độ)[^?\n]{0,80}(?:thiết bị|dụng cụ)|(?:thiết bị|dụng cụ)[^?\n]{0,80}(?:kinh nghiệm|trình độ)/iu.test(text) ||
          !/(?:chấn thương|xương khớp)/iu.test(text) ||
          /(?:dị ứng|thuần chay|không ăn thịt|chế độ ăn)/iu.test(text))) {
      failures.push("workout intake questions are not prioritized correctly");
    }
    if (rule.requestType === "meal" && !/(?:dị ứng|không dung nạp|chế độ ăn)/iu.test(text)) {
      failures.push("meal intake questions omitted allergy or dietary constraints");
    }
  },
};

export function evaluateSemanticOutput({ output, rules }) {
  if (!isPlainObject(output)) throw new Error("output must be an object");
  const failures = [];
  for (const rule of asArray(rules, "rules")) {
    if (!isPlainObject(rule) || typeof rule.type !== "string" || !evaluators[rule.type]) {
      throw new Error("semantic rule type is invalid");
    }
    evaluators[rule.type](output, rule, failures);
  }
  return failures;
}
