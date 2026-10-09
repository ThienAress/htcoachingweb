const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .trim();

// These are grammatical noun phrases, not a list of people or entry IDs.
const GENERAL_NOUN_PHRASES = new Set([
  "moi truong hop", "moi doi tuong", "moi nguoi", "moi nguoi tap gym",
  "moi bai tap chan", "tat ca", "phan tap quan trong", "khoi dong phu hop",
  "trai cay nguyen qua", "viec giam mo khong", "co bap", "nong nguoi",
  "sung thay preworkout",
]);

export const isGeneralKnowledgeNounPhrase = (value) => GENERAL_NOUN_PHRASES.has(normalize(value));

export const isBibliographicArticlePhrase = (value) =>
  /^(?:a|an|the)\s+(?:umbrella|systematic|narrative|scoping)\s+review$/.test(normalize(value));

// Preserve grammatical phrases before accent folding turns "tối" into "tôi",
// "chứng minh" into a subject named Minh, or "cố định" into an assertion cue.
export const maskVietnameseGeneralPhrases = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/(?<![\p{L}\p{N}_])chứng minh(?![\p{L}\p{N}_])/giu, "scientific_evidence")
  .replace(/(?<![\p{L}\p{N}_])cố định(?![\p{L}\p{N}_])/giu, "constant_rule")
  .replace(/(?<![\p{L}\p{N}_])tối(?![\p{L}\p{N}_])/giu, "evening_time");

const SENTENCE_START_PHRASES = new Map([
  ["khong", /^\s+(?:co (?:bang chung|co so|quy tac)|nen|can|bat buoc)\b/],
  ["co", /^\s+nen\b/],
  ["nen", /^\s+tap\b/],
  ["moi", /^\s+tap\b/],
  ["nguoi", /^\s+co gen\b/],
  ["di", /^\s+tap\b/],
  ["quen", /^\s+uong protein\b/],
]);

export function isGeneralKnowledgeSyntax({ text, index, name }) {
  const prefix = String(text || "").slice(0, index);
  const suffix = normalize(String(text || "").slice(index + name.length));
  const predicate = SENTENCE_START_PHRASES.get(normalize(name));
  if (predicate && (!prefix.trim() || /[.!?\n]\s*$/.test(prefix))) {
    return predicate.test(` ${suffix}`);
  }
  return normalize(name) === "bao" && /(?:moi nguoi|nguoi ta)\s+$/i.test(normalize(prefix) + " ") &&
    /^(?:muon|rang|la)\b/.test(suffix);
}
