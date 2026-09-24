const MAX_SAFETY_MESSAGE_CHARACTERS = 8000;
const MAX_RETRIEVAL_QUERY_CHARACTERS = 2000;
const MAX_CONTEXTUAL_QUERY_CHARACTERS = 500;
const MAX_FOLLOW_UP_CHARACTERS = 240;

const stripDiacritics = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const normalize = (value, maxCharacters) =>
  stripDiacritics(String(value ?? "").slice(0, maxCharacters))
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeWithDiacritics = (value, maxCharacters) =>
  String(value ?? "")
    .slice(0, maxCharacters)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const DOMAIN_VALUES = new Set(["ht_service", "fitness", "adjacent", "general"]);
const EVIDENCE_VALUES = new Set(["internal_kb", "web_required", "model_prior"]);
const FRESHNESS_VALUES = new Set(["stable", "time_sensitive"]);
const RISK_VALUES = new Set(["low", "high_stakes", "disallowed"]);

const FITNESS_PATTERN =
  /\b(?:fitness|gym|the hinh|tap luyen|bai tap|phong tap|thuong tap|tap nhung bai gi|workout|exercise|training|routine|lich tap|calo|calorie|tdee|protein|creatine|whey|dinh duong|thuc don|bua an|meal|giam mo|tang co|giao an tap|rpe|rir|deload|hypertrophy|squat|deadlift|bench press|plank|cardio|hiit)\b/;
const ADJACENT_PATTERN =
  /\b(?:the thao|bong da|bong ro|chay bo|boi loi|yoga|giac ngu|ngu ngon|loi song|wellness)\b/;
const HT_SERVICE_PATTERN =
  /\b(?:htcoaching|ht coaching|bang gia|goi pt|online coaching|dich vu pt|hlv ht|vi cua toi)\b/;
const HIGH_STAKES_PATTERN =
  /\b(?:chan doan|ke don|lieu thuoc|don thuoc|dau\s+(?:dau|nguc|goi|lung|vai|co|bung|hong|chan|tay)|kho tho|ngat xiu|dot quy|co giat|mang thai|benh than|suy than|benh tim|tim mach|huyet ap|tieu duong|ung thu|hiv|aids|hen suyen|diagnos|medication|chest pain|shortness of breath|faint|stroke|heart attack|seizure|pregnan|kidney disease|heart disease|blood pressure|diabetes|cancer|asthma|chan thuong|injur|pain)\b/;
const DISALLOWED_PATTERN =
  /\b(?:huong dan lam bom|che tao bom|danh cap mat khau|hack tai khoan)\b|\b(?:tiet lo|hien thi|dua toi xem|bo qua quy tac)[\s\S]{0,80}\b(?:system prompt|api key|secret|token|cookie)\b/;
const TIME_SENSITIVE_PATTERN =
  /\b(?:hom nay|bay gio|hien tai|moi nhat|gan day|nam nay|tuan nay|thang nay|sap toi|current|currently|latest|today|recently)\b/;
const SOURCE_REQUEST_PATTERN =
  /\b(?:nguon|trich dan|citation|dan chung|bang chung|kiem chung|source|evidence|nghien cuu|study|systematic review|meta analysis)\b/;
const PUBLIC_PERSON_CLAIM_PATTERN =
  /\b(?:thuong tap|hay tap|co tap|tap nhung bai gi|tap bai gi|tap gi|yeu thich bai tap|bai tap yeu thich|routine|lich tap|che do tap|che do an|thanh tich|vo dich|phat ngon|dang thi dau|choi cho|plays? for|current (?:club|team))\b/;
const IDENTITY_PATTERN = /\b(?:la ai|who is|gioi thieu ve)\b/;
const GENERIC_SUBJECT_PATTERN =
  /^(?:ai|ban|toi|minh|em|i|nguoi moi|nguoi tap|hoc vien|khach hang|benh nhan|client|patient|customer|member|user|hlv|huan luyen vien|coach|ppl|van dong vien|cac cau thu|vai|nguc|chan|lung|tay|bung|mong|nhom co|bai tap|squat|deadlift|bench press|plank|cardio|hiit|cach (?:tang|giam|siet))\b/;
const EXERCISE_ENTITY_PATTERN =
  /\b(?:squat|deadlift|press|row|pulldown|fly|curl|extension|raise|lunge|plank|crunch|push up|pull up|dip|burpee|leg press|leg curl)\b/;
const PLANNING_PATTERN =
  /^(?:(?:hay|vui long|co the)\s+)*(?:(?:giup|ho tro)(?:\s+(?:toi|minh|em))?\s+)?(?:tao|lap|xay dung|goi y|de xuat|lam|soan|thiet ke|viet|len)\s+(?:.*\b)?(?:lich tap|ke hoach|giao an|thuc don|bua an|meal plan)\b/;
const TDEE_ACTION_PATTERN =
  /\b(?:tinh|uoc tinh|calculate|estimate)\b[\s\S]{0,80}\b(?:tdee|bmr|calo|calorie)|\b(?:tdee|bmr|calo moi ngay|calorie needs?)\b[\s\S]{0,40}\b(?:cua toi|cua minh|cho toi|cho minh|my|for me)\b/;
const MEAL_ACTION_PATTERN =
  /\b(?:goi y|tao|lap|xay dung|de xuat|cho toi|cho minh|toi muon|suggest|create|build|make|want)\b[\s\S]{0,80}\b(?:thuc don|bua an|bua sang|bua trua|bua toi|meal plan|meals?)\b/;
const EXERCISE_PATTERN =
  /\b(?:cach tap|ky thuat|dung cach|huong dan|form|tim bai tap|nhom co|tap nguc|tap lung|tap chan|tap vai|tap tay|tap bung|tap mong|exercise|workout)\b/;
const WORKOUT_CREATION_PATTERN =
  /\b(?:tao|lap|xay dung|de xuat|goi y|soan|thiet ke|viet|len)\b[\s\S]{0,100}\b(?:lich tap|giao an|chuong trinh tap|workout plan|ke hoach tap)\b/;

const isLikelyPublicPerson = (normalized) => {
  if (PLANNING_PATTERN.test(normalized)) return false;
  if (IDENTITY_PATTERN.test(normalized) && !PUBLIC_PERSON_CLAIM_PATTERN.test(normalized)) {
    return false;
  }
  const predicateIndex = normalized.search(PUBLIC_PERSON_CLAIM_PATTERN);
  if (predicateIndex < 0) return false;
  const subject = normalized.slice(0, predicateIndex).trim();
  if (!subject || GENERIC_SUBJECT_PATTERN.test(subject) || EXERCISE_ENTITY_PATTERN.test(subject)) {
    return false;
  }
  return subject.split(/\s+/).length <= 5;
};

const inferDomain = (normalized, withDiacritics) => {
  if (HT_SERVICE_PATTERN.test(normalized)) return "ht_service";
  if (FITNESS_PATTERN.test(normalized) || /(?:chấn thương|đau)/u.test(withDiacritics)) return "fitness";
  if (ADJACENT_PATTERN.test(normalized)) return "adjacent";
  return "general";
};

export function buildStandaloneRetrievalQuery(message, priorMessages = []) {
  const current = String(message ?? "").trim().slice(0, MAX_RETRIEVAL_QUERY_CHARACTERS);
  if (!current || current.length > MAX_FOLLOW_UP_CHARACTERS) return current;
  const normalized = normalize(current, MAX_RETRIEVAL_QUERY_CHARACTERS);
  if (!/^(?:con|the con|vay con|ngoai ra|noi them|goi y them|what else|any other)\b/.test(normalized)) {
    return current;
  }
  const previous = [...(Array.isArray(priorMessages) ? priorMessages : [])]
    .reverse()
    .find((item) => item?.role === "user" && typeof item.content === "string" && item.content.trim());
  if (!previous) return current;
  const prefix = previous.content.trim().slice(0, Math.max(0, MAX_CONTEXTUAL_QUERY_CHARACTERS - current.length - 1));
  return prefix ? `${prefix}\n${current}` : current;
}

const freeze = (decision) => Object.freeze({
  ...decision,
  reasonCodes: Object.freeze(decision.reasonCodes),
});

export function routeAiRequest(message, { contextualQuery = message } = {}) {
  const normalized = normalize(contextualQuery, MAX_RETRIEVAL_QUERY_CHARACTERS);
  const withDiacritics = normalizeWithDiacritics(contextualQuery, MAX_RETRIEVAL_QUERY_CHARACTERS);
  const safety = normalize(message, MAX_SAFETY_MESSAGE_CHARACTERS);
  const domain = inferDomain(normalized, withDiacritics);
  const publicPersonClaim = isLikelyPublicPerson(normalized);
  const freshness = TIME_SENSITIVE_PATTERN.test(normalized) ? "time_sensitive" : "stable";
  const risk = DISALLOWED_PATTERN.test(safety)
    ? "disallowed"
    : HIGH_STAKES_PATTERN.test(safety)
      ? "high_stakes"
      : "low";
  const explicitEvidence = SOURCE_REQUEST_PATTERN.test(normalized);
  const workoutCreation = domain === "fitness" && WORKOUT_CREATION_PATTERN.test(normalized);
  const preferredTool = risk !== "low" || publicPersonClaim
    ? null
    : TDEE_ACTION_PATTERN.test(normalized)
      ? "calculate_tdee"
      : MEAL_ACTION_PATTERN.test(normalized)
        ? "suggest_meal"
      : workoutCreation
        ? null
        : EXERCISE_PATTERN.test(normalized)
          ? "search_exercises"
          : null;
  const webRequired = risk === "low" && (
    publicPersonClaim ||
    ((freshness === "time_sensitive" || explicitEvidence) && !preferredTool)
  );
  const evidence = webRequired
    ? "web_required"
    : (domain === "fitness" || domain === "ht_service") && risk === "low"
      ? "internal_kb"
      : "model_prior";
  const reasonCodes = [];
  if (publicPersonClaim) reasonCodes.push("public_person_claim");
  if (freshness === "time_sensitive") reasonCodes.push("time_sensitive");
  if (explicitEvidence) reasonCodes.push("source_requested");
  if (workoutCreation) reasonCodes.push("workout_creation");
  if (preferredTool) reasonCodes.push("preferred_tool");
  if (reasonCodes.length === 0) reasonCodes.push(`${domain}_stable`);
  return freeze({
    schemaVersion: 1,
    domain,
    freshness,
    evidence,
    risk,
    urgency: null,
    knowledgeBaseEligible: evidence === "internal_kb",
    webSearchRequired: webRequired,
    preferredTool: webRequired ? "search_knowledge" : preferredTool,
    maxWebSearchCalls: webRequired ? 1 : 0,
    reasonCodes,
  });
}

export function getAllowedToolNamesForRoute(decision) {
  if (!decision || decision.schemaVersion !== 1) return Object.freeze([]);
  if (decision.evidence === "model_prior" || decision.risk === "disallowed") return Object.freeze([]);
  if (decision.webSearchRequired) return Object.freeze(["search_knowledge"]);
  if (decision.reasonCodes?.includes("workout_creation")) return Object.freeze([]);
  if (decision.preferredTool) return Object.freeze([decision.preferredTool]);
  return decision.domain === "fitness"
    ? Object.freeze(["search_exercises", "search_blog"])
    : Object.freeze([]);
}

export function buildRequestRoutingBlock(decision, { canUseWebSearch = false } = {}) {
  if (!decision || decision.schemaVersion !== 1) return "";
  const lines = [
    "## ROUTING CHO YÊU CẦU HIỆN TẠI — QUYẾT ĐỊNH TỪ SERVER",
    `- domain=${decision.domain}; freshness=${decision.freshness}; evidence=${decision.evidence}; risk=${decision.risk}.`,
    "- Routing chỉ điều phối nguồn dữ kiện; không thay đổi safety, privacy hoặc quyền gọi function.",
  ];
  if (decision.evidence === "web_required") {
    lines.push(
      canUseWebSearch
        ? "- Chỉ khẳng định claim cần freshness/nguồn sau khi search_knowledge trả nguồn hỗ trợ; nếu không có nguồn thì nói chưa thể xác minh."
        : "- Web search không khả dụng; không dùng trí nhớ model để khẳng định claim cần nguồn.",
    );
  } else if (decision.evidence === "internal_kb" && decision.risk === "low") {
    lines.push(
      "- KB/tool là enrichment. Nếu không có dữ kiện phù hợp, trả lời kiến thức fitness ổn định bằng model prior với ngôn ngữ phù hợp; không biến KB miss thành lỗi hoặc lời từ chối.",
    );
  } else if (decision.evidence === "model_prior") {
    lines.push("- Trả lời trực tiếp bằng kiến thức nền phù hợp; không gọi retrieval hay tool nếu không cần.");
  }
  return `\n\n${lines.join("\n")}`;
}
