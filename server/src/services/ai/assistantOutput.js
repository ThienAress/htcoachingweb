import { truncateAssistantText } from "./responseStreamer.js";

const PSEUDO_ACTION_PATTERN =
  /\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?"action_input"\s*:[\s\S]*?\}/gi;

const INTERNAL_PROTOCOL_PATTERN =
  /\b(?:search_knowledge|search_exercises|suggest_meal|calculate_tdee|get_trainer_info|check_wallet|get_workout_plan|search_blog|get_checkin_history|get_gym_info|get_training_schedule|function_?call(?:ing)?|tool_?call|action_input|ui_card)\b/i;

const INTERNAL_CAPABILITY_NARRATION_PATTERN =
  /(?:được\s+)?trang\s+bị.*(?:công\s+cụ|tools?)|(?:công\s+cụ|tools?).*(?:kết\s+nối|dữ\s+liệu\s+thực\s+tế|nội\s+bộ)/i;

const JSON_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const PROTOCOL_RESIDUE_PATTERN = /^[\s{}\[\],:]*$/;

const getStructuredCandidate = (value) => {
  const source = String(value || "").trim();
  const fenced = source.match(JSON_FENCE_PATTERN);
  return (fenced?.[1] ?? source).trim();
};

const containsPseudoActionEnvelope = (value) => {
  const candidate = getStructuredCandidate(value);
  if (!candidate) return false;
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return false;
  }
  const visit = (node) => {
    if (Array.isArray(node)) return node.some(visit);
    if (!node || typeof node !== "object") return false;
    if (
      typeof node.action === "string" &&
      Object.prototype.hasOwnProperty.call(node, "action_input")
    ) {
      return true;
    }
    return Object.values(node).some(visit);
  };
  return visit(parsed);
};

const looksLikeMalformedStructuredOutput = (value) => {
  const candidate = getStructuredCandidate(value);
  if (!candidate) return false;
  if (/^[{}\[\]]$/.test(candidate)) return true;
  const startsLikeJsonContainer = candidate.startsWith("{") ||
    /^\[\s*\{/.test(candidate);
  if (!startsLikeJsonContainer) return false;

  try {
    JSON.parse(candidate);
    return false;
  } catch {
    return true;
  }
};

const COMPLETE_MARKDOWN_LINK_PATTERN =
  /\[[^\]\n]{0,500}\]\((?:<https?:\/\/[^\s<>]+>|https?:\/\/[^\s)]+)\)/gi;
const COMPLETE_URL_PATTERN = /https?:\/\/[^\s<>]+/gi;

const sliceWithoutBreakingLinks = (value, maximum) => {
  const source = String(value || "");
  if (source.length <= maximum) return source;
  let cutAt = Math.max(0, maximum);

  for (const pattern of [COMPLETE_MARKDOWN_LINK_PATTERN, COMPLETE_URL_PATTERN]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index === undefined) continue;
      const matchEnd = match.index + match[0].length;
      if (match.index < cutAt && matchEnd > cutAt) {
        cutAt = Math.min(cutAt, match.index);
      }
    }
  }

  return truncateAssistantText(source, cutAt).trimEnd();
};

const buildSourceBlock = (items, limit) => {
  const selected = [];
  for (const item of items) {
    const link = `[${item.title}](<${item.uri}>)`;
    const candidate = `\n\n📎 *Nguồn: ${[...selected, link].join(" · ")}*`;
    if (candidate.length > limit) break;
    selected.push(link);
  }
  return {
    block: selected.length > 0
      ? `\n\n📎 *Nguồn: ${selected.join(" · ")}*`
      : "",
    selectedCount: selected.length,
  };
};

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

export function boundAssistantOutputWithSources(
  value,
  { sources = [], maxCharacters = 20000 } = {},
) {
  const parsedLimit = Number(maxCharacters);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 20000)
    : 20000;
  const source = String(value || "");
  const normalizedSources = (Array.isArray(sources) ? sources : [])
    .slice(0, 3)
    .map((item) => ({
      title: String(item?.title || "").trim(),
      uri: String(item?.uri || "").trim(),
    }))
    .filter((item) => item.title && item.uri)
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.uri === item.uri) === index,
    );

  if (normalizedSources.length === 0) {
    return sliceWithoutBreakingLinks(source, limit);
  }

  let toAppend = normalizedSources.filter(
    (item) => !sliceWithoutBreakingLinks(source, limit).includes(item.uri),
  );
  let body = "";
  let block = "";

  for (let iteration = 0; iteration < 5; iteration++) {
    const built = buildSourceBlock(toAppend, limit);
    block = built.block;
    body = sliceWithoutBreakingLinks(source, limit - block.length);
    const missing = normalizedSources.filter((item) => !body.includes(item.uri));
    const next = missing.slice(0, buildSourceBlock(missing, limit).selectedCount);
    if (
      next.length === toAppend.length &&
      next.every((item, index) => item.uri === toAppend[index]?.uri)
    ) {
      return `${body}${block}`;
    }
    toAppend = next;
  }

  return `${body}${block}`;
}

export function sanitizeAssistantOutput(value) {
  const source = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!source) {
    return { content: "", protocolLeak: true };
  }
  if (looksLikeMalformedStructuredOutput(source)) {
    return { content: "", protocolLeak: true };
  }
  if (containsPseudoActionEnvelope(source)) {
    return { content: "", protocolLeak: true };
  }
  const hasPseudoAction = PSEUDO_ACTION_PATTERN.test(source);
  PSEUDO_ACTION_PATTERN.lastIndex = 0;

  const withoutActions = source.replace(PSEUDO_ACTION_PATTERN, "");
  PSEUDO_ACTION_PATTERN.lastIndex = 0;
  const paragraphs = withoutActions.split(/\n{2,}/);
  const safeParagraphs = paragraphs.filter((paragraph) =>
    !isToolNarration(paragraph) &&
    !(hasPseudoAction && PROTOCOL_RESIDUE_PATTERN.test(paragraph.trim())),
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
