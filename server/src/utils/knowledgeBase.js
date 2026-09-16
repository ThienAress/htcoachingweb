import { EMBEDDING_VERSION } from "../services/ai/embeddingProfile.js";

export const KNOWLEDGE_CATEGORIES = [
  "service",
  "nutrition",
  "training",
  "athlete",
  "equipment",
  "supplement",
  "health",
  "hlv",
  "platform",
  "general",
];

export const KNOWLEDGE_STATUSES = ["draft", "published", "archived"];
export const KNOWLEDGE_SOURCE_TYPES = [
  "internal",
  "official",
  "research",
  "professional",
  "editorial",
  "conversation",
];
export const KNOWLEDGE_EVIDENCE_TIERS = [
  "canonical",
  "primary",
  "professional",
  "secondary",
  "conversation",
  "legacy_unknown",
];
export const KNOWLEDGE_EVIDENCE_LEVELS = [
  "legacy_unverified",
  "editor_reviewed",
  "source_backed",
  "canonical_internal",
];
export const KNOWLEDGE_REVIEW_STATUSES = ["needs_review", "reviewed", "stale"];
export const KNOWLEDGE_FRESHNESS_CLASSES = ["stable", "periodic", "time_sensitive"];
export const MAX_KNOWLEDGE_VARIANTS = 20;
export const MAX_KNOWLEDGE_TAGS = 20;
export const MAX_KNOWLEDGE_SOURCES = 10;

const EXTERNAL_SOURCE_TYPES = new Set([
  "official",
  "research",
  "professional",
  "editorial",
]);
const CANONICAL_INTERNAL_CATEGORIES = new Set(["service", "hlv", "platform"]);
const EDITOR_REVIEWED_CATEGORIES = new Set(["training", "equipment", "general"]);
const EDITOR_REVIEWED_TIERS = new Set(["professional", "secondary"]);
const SOURCE_BACKED_TIERS = new Set([
  "canonical",
  "primary",
  "professional",
  "secondary",
]);

export function normalizeKnowledgeQuestion(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const cleanString = (value, field, maxLength, required) => {
  if (value === undefined && !required) return { value: undefined };
  if (typeof value !== "string" || !value.trim()) {
    return { error: `${field} không được để trống` };
  }
  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    return { error: `${field} không được vượt quá ${maxLength} ký tự` };
  }
  return { value: cleaned };
};

const cleanStringList = (value, field, { maxItems, maxLength }) => {
  if (!Array.isArray(value)) return { error: `${field} phải là một danh sách` };
  if (value.length > maxItems) {
    return { error: `${field} không được vượt quá ${maxItems} mục` };
  }

  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) continue;
    const cleaned = item.trim();
    if (cleaned.length > maxLength) {
      return { error: `Mỗi mục trong ${field} không được vượt quá ${maxLength} ký tự` };
    }
    const normalized = normalizeKnowledgeQuestion(cleaned);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(cleaned);
    }
  }
  return { value: result };
};

const cleanOptionalString = (value, field, maxLength) => {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: `${field} phải là chuỗi` };
  const cleaned = value.trim();
  if (!cleaned) return { value: null };
  if (cleaned.length > maxLength) {
    return { error: `${field} không được vượt quá ${maxLength} ký tự` };
  }
  return { value: cleaned };
};

const cleanDate = (value, field) => {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  if (!(typeof value === "string" || value instanceof Date)) {
    return { error: `${field} phải là ngày hợp lệ` };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${field} phải là ngày hợp lệ` };
  return { value: date };
};

const CREDENTIAL_QUERY_NAMES = new Set([
  "token",
  "key",
  "secret",
  "password",
  "passwd",
  "signature",
  "sig",
  "apikey",
  "accesstoken",
  "authtoken",
  "refreshtoken",
  "idtoken",
  "bearertoken",
  "clientsecret",
  "secretkey",
  "authorization",
  "authcode",
  "oauthcode",
  "authorizationcode",
  "credential",
  "jwt",
  "auth",
  "session",
  "sessionid",
  "sessiontoken",
  "jsessionid",
  "phpsessid",
  "xamzcredential",
  "xamzsignature",
  "awsaccesskeyid",
]);

const CREDENTIAL_QUERY_SUFFIXES = [
  "token",
  "apikey",
  "secretkey",
  "secret",
  "password",
  "passwd",
  "signature",
  "authorization",
  "authcode",
  "credential",
  "sessionid",
  "sessid",
  "accesskeyid",
];

const normalizeCredentialQueryName = (value) =>
  String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

const isCredentialParameterName = (value) => {
  const name = normalizeCredentialQueryName(value);
  return (
    CREDENTIAL_QUERY_NAMES.has(name) ||
    CREDENTIAL_QUERY_SUFFIXES.some(
      (suffix) => name.length > suffix.length && name.endsWith(suffix),
    )
  );
};

export const hasKnowledgeSourceCredentialQuery = (url) =>
  [...url.searchParams.keys()].some(isCredentialParameterName);

const decodeUrlPathCandidates = (pathname) => {
  const candidates = [String(pathname || "")];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(candidates.at(-1));
      if (decoded === candidates.at(-1)) break;
      candidates.push(decoded);
    } catch {
      break;
    }
  }
  return candidates;
};

const hasKnowledgeSourceCredentialPathParameter = (url) =>
  decodeUrlPathCandidates(url.pathname).some((pathname) =>
    pathname.split("/").some((segment) =>
      segment
        .split(";")
        .slice(1)
        .some((parameter) =>
          isCredentialParameterName(parameter.split("=", 1)[0]),
        ),
    ),
  );

const hasKnowledgeSourceCredentialPathSegment = (url) =>
  decodeUrlPathCandidates(url.pathname).some((pathname) => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.some(
      (segment, index) =>
        index < segments.length - 1 && isCredentialParameterName(segment),
    );
  });

export const hasKnowledgeSourceCredentialParameters = (url) =>
  hasKnowledgeSourceCredentialQuery(url) ||
  hasKnowledgeSourceCredentialPathParameter(url) ||
  hasKnowledgeSourceCredentialPathSegment(url);

const cleanHttpsUrl = (value, field, { required = false } = {}) => {
  const parsed = cleanOptionalString(value, field, 2048);
  if (parsed.error) return parsed;
  if (!parsed.value) {
    return required ? { error: `${field} phải là URL HTTPS` } : { value: null };
  }
  try {
    const url = new URL(parsed.value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return { error: `${field} phải là URL HTTPS không chứa thông tin đăng nhập` };
    }
    if (hasKnowledgeSourceCredentialParameters(url)) {
      return { error: `${field} không được chứa tham số xác thực` };
    }
    return { value: url.toString() };
  } catch {
    return { error: `${field} phải là URL HTTPS hợp lệ` };
  }
};

const cleanKnowledgeSources = (value) => {
  if (!Array.isArray(value)) return { error: "sources phải là một danh sách" };
  if (value.length > MAX_KNOWLEDGE_SOURCES) {
    return { error: `sources không được vượt quá ${MAX_KNOWLEDGE_SOURCES} mục` };
  }

  const allowed = new Set([
    "type",
    "title",
    "publisher",
    "url",
    "publishedAt",
    "retrievedAt",
    "evidenceTier",
  ]);
  const seen = new Set();
  const sources = [];

  for (const [index, source] of value.entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return { error: `sources[${index}] không hợp lệ` };
    }
    const unknown = Object.keys(source).find((key) => !allowed.has(key));
    if (unknown) return { error: `Trường sources[${index}].${unknown} không được hỗ trợ` };
    if (!KNOWLEDGE_SOURCE_TYPES.includes(source.type)) {
      return { error: `sources[${index}].type không hợp lệ` };
    }
    if (!KNOWLEDGE_EVIDENCE_TIERS.includes(source.evidenceTier)) {
      return { error: `sources[${index}].evidenceTier không hợp lệ` };
    }

    const title = cleanString(source.title, `sources[${index}].title`, 300, true);
    if (title.error) return title;
    const publisher = cleanString(
      source.publisher,
      `sources[${index}].publisher`,
      200,
      true,
    );
    if (publisher.error) return publisher;
    const url = cleanHttpsUrl(source.url, `sources[${index}].url`, {
      required: EXTERNAL_SOURCE_TYPES.has(source.type),
    });
    if (url.error) return url;
    const publishedAt = cleanDate(source.publishedAt, `sources[${index}].publishedAt`);
    if (publishedAt.error) return publishedAt;
    const retrievedAt = cleanDate(source.retrievedAt, `sources[${index}].retrievedAt`);
    if (retrievedAt.error) return retrievedAt;

    const dedupeKey = `${source.type}|${url.value || ""}|${normalizeKnowledgeQuestion(title.value)}|${normalizeKnowledgeQuestion(publisher.value)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    sources.push({
      type: source.type,
      title: title.value,
      publisher: publisher.value,
      url: url.value,
      publishedAt: publishedAt.value ?? null,
      retrievedAt: retrievedAt.value ?? null,
      evidenceTier: source.evidenceTier,
    });
  }

  return { value: sources };
};

const invalidPublication = (code, message) => ({ valid: false, code, message });

const validatePublicationEmbeddingProfile = (entry) => {
  if (
    entry?.embeddingStatus === "ready" &&
    entry.embeddingVersion !== EMBEDDING_VERSION
  ) {
    return invalidPublication(
      "KNOWLEDGE_EMBEDDING_VERSION_MISMATCH",
      "Hãy tạo lại embedding bằng profile hiện hành trước khi publish",
    );
  }
  return { valid: true };
};

export function validateKnowledgePublication(entry, { now = new Date() } = {}) {
  const evidenceLevel = entry?.evidenceLevel || "legacy_unverified";
  const sources = Array.isArray(entry?.sources) ? entry.sources : [];
  const category = entry?.category || "general";
  const freshnessClass = entry?.freshnessClass || "stable";

  if (evidenceLevel === "legacy_unverified") {
    return invalidPublication(
      "KNOWLEDGE_EVIDENCE_UNVERIFIED",
      "Entry legacy chưa được xác minh nên không thể publish",
    );
  }
  if (
    CANONICAL_INTERNAL_CATEGORIES.has(category) &&
    evidenceLevel !== "canonical_internal"
  ) {
    return invalidPublication(
      "KNOWLEDGE_CANONICAL_INTERNAL_REQUIRED",
      "Entry service, hlv hoặc platform phải dùng canonical_internal với nguồn nội bộ canonical",
    );
  }
  if (sources.length === 0) {
    return invalidPublication(
      "KNOWLEDGE_SOURCE_REQUIRED",
      "Cần ít nhất một nguồn phù hợp trước khi publish",
    );
  }

  const reviewDueAt = entry?.reviewDueAt ? new Date(entry.reviewDueAt) : null;
  if (
    reviewDueAt &&
    (Number.isNaN(reviewDueAt.getTime()) || reviewDueAt <= now)
  ) {
    return invalidPublication(
      "KNOWLEDGE_REVIEW_DUE_REQUIRED",
      "reviewDueAt phải nằm trong tương lai trước khi publish",
    );
  }
  if (["periodic", "time_sensitive"].includes(freshnessClass)) {
    if (!reviewDueAt) {
      return invalidPublication(
        "KNOWLEDGE_REVIEW_DUE_REQUIRED",
        "Entry cần reviewDueAt trong tương lai trước khi publish",
      );
    }
  }

  if (evidenceLevel === "canonical_internal") {
    const hasCanonicalSource = sources.some(
      (source) => source.type === "internal" && source.evidenceTier === "canonical",
    );
    if (!CANONICAL_INTERNAL_CATEGORIES.has(category) || !hasCanonicalSource) {
      return invalidPublication(
        "KNOWLEDGE_CANONICAL_INTERNAL_INVALID",
        "canonical_internal chỉ dành cho service, hlv hoặc platform với nguồn internal canonical",
      );
    }
    return validatePublicationEmbeddingProfile(entry);
  }

  if (evidenceLevel === "editor_reviewed") {
    const hasEditorialSource = sources.some(
      (source) =>
        ["professional", "editorial"].includes(source.type) &&
        EDITOR_REVIEWED_TIERS.has(source.evidenceTier) &&
        typeof source.url === "string" &&
        source.url.startsWith("https://"),
    );
    if (!EDITOR_REVIEWED_CATEGORIES.has(category) || !hasEditorialSource) {
      return invalidPublication(
        "KNOWLEDGE_EDITOR_REVIEW_INVALID",
        "editor_reviewed chỉ dành cho training, equipment hoặc general với nguồn professional/editorial HTTPS",
      );
    }
    return validatePublicationEmbeddingProfile(entry);
  }

  if (evidenceLevel === "source_backed") {
    const hasExternalEvidence = sources.some(
      (source) =>
        EXTERNAL_SOURCE_TYPES.has(source.type) &&
        SOURCE_BACKED_TIERS.has(source.evidenceTier) &&
        typeof source.url === "string" &&
        source.url.startsWith("https://"),
    );
    return hasExternalEvidence
      ? validatePublicationEmbeddingProfile(entry)
      : invalidPublication(
          "KNOWLEDGE_EXTERNAL_SOURCE_REQUIRED",
          "source_backed cần ít nhất một nguồn ngoài HTTPS phù hợp",
        );
  }

  return invalidPublication(
    "KNOWLEDGE_EVIDENCE_LEVEL_INVALID",
    "Mức evidence không hợp lệ",
  );
}

export function withKnowledgeEvidenceDefaults(entry) {
  if (!entry || typeof entry !== "object") return entry;
  return {
    ...entry,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    evidenceLevel: entry.evidenceLevel || "legacy_unverified",
    reviewStatus: entry.reviewStatus || "needs_review",
    freshnessClass: entry.freshnessClass || "stable",
    reviewedBy: entry.reviewedBy || null,
    reviewedAt: entry.reviewedAt || null,
    reviewDueAt: entry.reviewDueAt || null,
    revision: Number.isInteger(entry.revision) && entry.revision > 0 ? entry.revision : 1,
  };
}

export function parseKnowledgeEntryPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Dữ liệu knowledge entry không hợp lệ" };
  }

  const allowed = new Set([
    "question",
    "answer",
    "category",
    "tags",
    "status",
    "variants",
    "sources",
    "evidenceLevel",
    "freshnessClass",
    "reviewDueAt",
    "skipDuplicateCheck",
  ]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) return { error: `Trường dữ liệu không được hỗ trợ: ${unknown}` };

  const result = {};
  for (const [field, maxLength] of [
    ["question", 500],
    ["answer", 5000],
  ]) {
    const parsed = cleanString(body[field], field, maxLength, !partial);
    if (parsed.error) return parsed;
    if (parsed.value !== undefined) result[field] = parsed.value;
  }

  if (body.category !== undefined) {
    if (!KNOWLEDGE_CATEGORIES.includes(body.category)) {
      return { error: "Danh mục knowledge entry không hợp lệ" };
    }
    result.category = body.category;
  }

  if (body.status !== undefined) {
    if (!KNOWLEDGE_STATUSES.includes(body.status)) {
      return { error: "Trạng thái knowledge entry không hợp lệ" };
    }
    result.status = body.status;
  }

  if (body.evidenceLevel !== undefined) {
    if (!KNOWLEDGE_EVIDENCE_LEVELS.includes(body.evidenceLevel)) {
      return { error: "Mức evidence của knowledge entry không hợp lệ" };
    }
    result.evidenceLevel = body.evidenceLevel;
  }

  if (body.freshnessClass !== undefined) {
    if (!KNOWLEDGE_FRESHNESS_CLASSES.includes(body.freshnessClass)) {
      return { error: "Freshness class của knowledge entry không hợp lệ" };
    }
    result.freshnessClass = body.freshnessClass;
  }

  if (body.reviewDueAt !== undefined) {
    const parsed = cleanDate(body.reviewDueAt, "reviewDueAt");
    if (parsed.error) return parsed;
    result.reviewDueAt = parsed.value;
  }

  if (body.sources !== undefined) {
    const parsed = cleanKnowledgeSources(body.sources);
    if (parsed.error) return parsed;
    result.sources = parsed.value;
  }

  if (body.tags !== undefined) {
    const parsed = cleanStringList(body.tags, "tags", {
      maxItems: MAX_KNOWLEDGE_TAGS,
      maxLength: 50,
    });
    if (parsed.error) return parsed;
    result.tags = parsed.value;
  }

  if (body.variants !== undefined) {
    const parsed = cleanStringList(body.variants, "variants", {
      maxItems: MAX_KNOWLEDGE_VARIANTS,
      maxLength: 500,
    });
    if (parsed.error) return parsed;
    const mainQuestion = normalizeKnowledgeQuestion(
      result.question || body.question,
    );
    result.variants = parsed.value.filter(
      (variant) => normalizeKnowledgeQuestion(variant) !== mainQuestion,
    );
  }

  if (body.skipDuplicateCheck !== undefined) {
    if (typeof body.skipDuplicateCheck !== "boolean") {
      return { error: "skipDuplicateCheck phải là boolean" };
    }
    result.skipDuplicateCheck = body.skipDuplicateCheck;
  }

  return { value: result };
}
