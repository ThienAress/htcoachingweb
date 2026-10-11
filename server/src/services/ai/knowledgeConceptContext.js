const normalize = (value) => String(value || "")
  .normalize("NFKC")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase();

const PRIVATE_LABEL_PATTERN =
  /\b(?:khach hang|hoc vien|benh nhan|client|patient|customer|member|user|biet danh|ten|ban toi|toi|minh|em|my|i)\b/;
const CONCEPT_PREFIX_PATTERN = /\b(?:tang nguoi|kieu hinh|thuat ngu|tinh trang)\s*$/;
const CONCEPT_DEFINITION_PATTERN = /^\s+(?:la\s+(?:gi|tinh trang|kieu hinh|thuat ngu)|nghia la)\b/;
const FITNESS_STRATEGY_ALTERNATIVE_PATTERN =
  /\b(?:bulking\s+(?:hay|hoac|or)\s+cutting|cutting\s+(?:hay|hoac|or)\s+bulking)\b/;
const NORMAL_RANGE_PREFIX_PATTERN = /\b(?:muc|trang thai|pham vi|gioi han)\s+binh\s*$/;

// Keep the role separate from a title-cased identity. This does not bind a
// person: only the question's existing public-role checks can do that.
export const normalizeAthleteRoleAbbreviations = (value) => String(value || "")
  .replace(/(?<![\p{L}\p{N}_])v[đd]v(?=\s+\p{Lu})/giu, (role) => role.toLowerCase());

// The caller supplies only identities already bound by the raw question.
// Answer/source text cannot introduce a new alias through this helper.
export function getDeclaredPublicAliases(value, publicNames) {
  const text = String(value || "");
  const aliases = [];
  for (const name of publicNames) {
    const index = text.indexOf(name);
    if (index < 0) continue;
    const following = text.slice(index + name.length);
    const alias = following.match(
      /^\s*\((\p{Lu}[\p{L}\p{M}'’-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]*){1,3})\)/u,
    )?.[1];
    if (alias && alias.length <= 60 && !PRIVATE_LABEL_PATTERN.test(normalize(alias))) {
      aliases.push(alias);
    }
  }
  return aliases;
}

// A concept cue is required; a person's nickname alone remains ambiguous.
export function isGeneralFitnessConceptReference({ text, index, name }) {
  const normalizedName = normalize(name).trim();
  const prefix = normalize(text.slice(Math.max(0, index - 120), index));
  const suffix = normalize(text.slice(index + name.length));
  if (PRIVATE_LABEL_PATTERN.test(prefix)) return false;
  if (normalizedName === "nen" && (!prefix.trim() || /[.!?]\s*$/.test(prefix))) {
    return /^\s+tap trung\s+/.test(suffix) && FITNESS_STRATEGY_ALTERNATIVE_PATTERN.test(suffix);
  }
  if (["bulking", "cutting"].includes(normalizedName)) {
    const nearby = normalize(text.slice(Math.max(0, index - 32), index + name.length + 32));
    return FITNESS_STRATEGY_ALTERNATIVE_PATTERN.test(nearby);
  }
  if (normalizedName !== "skinny fat") return false;
  return CONCEPT_PREFIX_PATTERN.test(prefix) || CONCEPT_DEFINITION_PATTERN.test(suffix);
}

// Disambiguate the adjective only after a range qualifier. A named subject
// such as "Bình thường uống insulin" still follows the private-name path.
export function isGeneralNormalRangeQualifier({ prefix, predicate, name }) {
  return name === "bình" && normalize(predicate) === "thuong" &&
    NORMAL_RANGE_PREFIX_PATTERN.test(normalize(prefix));
}
