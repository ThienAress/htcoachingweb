import { answerNeedsKnowledgeCitation, stripUnselectedKnowledgeCitations } from "./answerSourcePolicy.js";
import { boundAssistantOutputWithSources } from "./assistantOutput.js";
import { getCitableKnowledgeSources } from "./systemPrompt.js";

const unwrapMarkdown = (value) => String(value || "").replace(
  /(?<![\p{L}\p{N}])(\*\*|__|`|\*|_)(?=\S)(.*?\S)\1(?![\p{L}\p{N}])/gu,
  "$2",
);

const normalizeClaim = (value) => {
  const plain = unwrapMarkdown(value).trim();
  if (!/[.!]$/.test(plain) || plain.includes("?") || /https?:\/\//iu.test(plain)) return null;
  const normalized = plain
    .replace(/^(?:[-•]\s+)?/u, "")
    .replace(/^theo\s+(?:nguồn chính thức|WHO|AAOS|Tổ chức Y tế Thế giới|World Health Organization)\s*,\s*/iu, "")
    .replace(/[.!]+$/, "").replace(/\s+/g, " ").toLocaleLowerCase("vi");
  return normalized.length >= 40 && normalized.split(" ").length >= 8 ? normalized : null;
};

const completeClauses = (value) => {
  const clauses = [];
  let start = 0;
  for (const boundary of value.matchAll(/[.!?][*_`]*(?=\s|$)|\n+/gu)) {
    const end = boundary.index + boundary[0].length;
    const text = value.slice(start, end).trim();
    const normalized = normalizeClaim(text);
    if (normalized) clauses.push({ text, normalized, end });
    start = end;
    if (clauses.length >= 128) break;
  }
  return clauses;
};

// A different question does not make a retrieved source authoritative. Only an
// intact factual clause copied from current reviewed evidence gets an inline link.
// Numbers, population, negation, intensity and units remain part of equality.
export const bindSupportedKnowledgeClaims = (value, { entries = [], decision, maxCharacters = 20000 } = {}) => {
  const unchanged = { content: String(value || ""), sources: [] };
  if (decision?.risk !== "low" || decision?.evidence !== "internal_kb" ||
    decision.preferredTool || decision.reasonCodes?.includes("workout_creation")) return unchanged;
  const plain = unwrapMarkdown(unchanged.content);
  if (/chưa (?:thể|đủ|tìm)|(?:chưa|cần|còn phải)\s+(?:xác minh|kiểm chứng)|bổ sung (?:thông tin|dữ liệu|số đo)|giới hạn xử lý|thử lại/iu.test(plain)) return unchanged;

  const supported = new Map();
  const retrievedSources = [];
  for (const entry of (Array.isArray(entries) ? entries : []).slice(0, 3)) {
    const sources = getCitableKnowledgeSources([entry]);
    if (!sources.length) continue;
    retrievedSources.push(...sources);
    for (const clause of completeClauses(String(entry.answer || "").slice(0, 6000))) {
      if (answerNeedsKnowledgeCitation(decision, clause.text) && !supported.has(clause.normalized)) {
        supported.set(clause.normalized, sources);
      }
    }
  }
  if (!supported.size) return unchanged;
  const content = stripUnselectedKnowledgeCitations(unchanged.content, { retrievedSources });
  const bindings = completeClauses(content).filter(clause => supported.has(clause.normalized)).slice(0, 3);
  if (!bindings.length) return { content, sources: [] };
  const selected = [];
  const insertions = [];
  for (const clause of bindings) {
    const sources = supported.get(clause.normalized).slice(0, 3);
    const links = [];
    for (const source of sources) {
      let index = selected.findIndex(item => item.uri === source.uri);
      if (index < 0 && selected.length >= 3) continue;
      if (index < 0) { selected.push(source); index = selected.length - 1; }
      links.push(`[Nguồn ${index + 1}](<${source.uri}>)`);
    }
    if (links.length) insertions.push({ end: clause.end, text: ` ${links.join(" · ")}` });
  }
  let rendered = content;
  for (const insertion of insertions.reverse()) {
    rendered = `${rendered.slice(0, insertion.end)}${insertion.text}${rendered.slice(insertion.end)}`;
  }
  rendered = boundAssistantOutputWithSources(rendered, { sources: [], maxCharacters });
  return { content: rendered, sources: selected.filter(source => rendered.includes(source.uri)) };
};
