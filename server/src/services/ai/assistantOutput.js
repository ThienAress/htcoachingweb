const PSEUDO_ACTION_PATTERN =
  /\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?"action_input"\s*:[\s\S]*?\}/gi;

const INTERNAL_PROTOCOL_PATTERN =
  /\b(?:search_knowledge|search_exercises|suggest_meal|calculate_tdee|get_trainer_info|check_wallet|get_workout_plan|search_blog|get_checkin_history|get_gym_info|get_training_schedule|function_call(?:ing)?|action_input|ui_card)\b/i;

const INTERNAL_CAPABILITY_NARRATION_PATTERN =
  /(?:được\s+)?trang\s+bị.*(?:công\s+cụ|tools?)|(?:công\s+cụ|tools?).*(?:kết\s+nối|dữ\s+liệu\s+thực\s+tế|nội\s+bộ)/i;

const isToolNarration = (paragraph) => {
  const text = paragraph
    .replace(/^_+|_+$/g, "")
    .trim()
    .toLocaleLowerCase("vi");
  return (
    /^bạn đợi mình/.test(text) ||
    INTERNAL_PROTOCOL_PATTERN.test(text) ||
    INTERNAL_CAPABILITY_NARRATION_PATTERN.test(text) ||
    /(?:đang|sẽ)\s+gọi\s+(?:tool|công cụ)/.test(text) ||
    /(?:cần|sẽ)\s+(?:kiểm tra|tra cứu).*(?:hệ thống|tool|công cụ)/.test(text)
  );
};

export function sanitizeAssistantOutput(value) {
  const source = String(value || "").replace(/\r\n/g, "\n").trim();
  const hasPseudoAction = PSEUDO_ACTION_PATTERN.test(source);
  PSEUDO_ACTION_PATTERN.lastIndex = 0;

  const withoutActions = source.replace(PSEUDO_ACTION_PATTERN, "");
  PSEUDO_ACTION_PATTERN.lastIndex = 0;
  const paragraphs = withoutActions.split(/\n{2,}/);
  const safeParagraphs = paragraphs.filter(
    (paragraph) => !isToolNarration(paragraph),
  );
  const removedInternalNarration =
    safeParagraphs.length !== paragraphs.length;
  const content = safeParagraphs.join("\n\n").trim();

  return {
    content,
    protocolLeak:
      (hasPseudoAction || removedInternalNarration) && !content,
  };
}
