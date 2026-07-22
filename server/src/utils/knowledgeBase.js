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
export const MAX_KNOWLEDGE_VARIANTS = 20;
export const MAX_KNOWLEDGE_TAGS = 20;

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
