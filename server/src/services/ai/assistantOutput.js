const PSEUDO_ACTION_PATTERN =
  /\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?"action_input"\s*:[\s\S]*?\}/gi;

const isToolNarration = (paragraph) => {
  const text = paragraph
    .replace(/^_+|_+$/g, "")
    .trim()
    .toLocaleLowerCase("vi");
  return (
    /^bạn đợi mình/.test(text) ||
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
  const content = withoutActions
    .split(/\n{2,}/)
    .filter((paragraph) => !isToolNarration(paragraph))
    .join("\n\n")
    .trim();

  return {
    content,
    protocolLeak: hasPseudoAction && !content,
  };
}
