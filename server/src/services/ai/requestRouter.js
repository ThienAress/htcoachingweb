import { containsPersonalHealthData } from "./personalHealthData.js";
import {
  getPublicPersonLookupNames,
  isCallerVettedPublicDateOfBirth,
  isCallerVettedPublicPersonClaim,
  prepareExternalKnowledgeQuery,
} from "./knowledgePrivacy.js";

const MAX_SAFETY_MESSAGE_CHARACTERS = 8000;
const MAX_RETRIEVAL_QUERY_CHARACTERS = 2000;

const DOMAIN_VALUES = new Set(["ht_service", "fitness", "adjacent", "general"]);
const FRESHNESS_VALUES = new Set(["stable", "time_sensitive"]);
const EVIDENCE_VALUES = new Set(["internal_kb", "web_required", "model_prior"]);
const RISK_VALUES = new Set(["low", "high_stakes", "disallowed"]);
const URGENCY_VALUES = new Set([null, "medical_emergency", "self_harm"]);

const HT_SERVICE_PATTERN =
  /\b(htcoaching|ht coaching|bang gia|goi (?:pt|online)|online coaching|dang ky (?:tu van|tap)|dich vu (?:pt|huan luyen)|huan luyen vien ht|hlv ht|vi cua toi)\b/;
const ACCENTED_HT_PACKAGE_PATTERN =
  /(?:^|\s)gói\s+(?:pt|tập|online)(?=\s|$)/u;
const ASCII_HT_PACKAGE_CONTEXT_PATTERN =
  /\b(?:mua|dang ky|gia|bang gia|cac|co|tu van|xem)\s+goi tap\b|\bgoi tap\s+(?:nao|gia|bao nhieu|thang|nam|pt|online)\b/;
const FITNESS_PATTERN =
  /\b(fitness|gym|the hinh|tap luyen|bai tap|phong tap|thuong tap|tap nhung bai gi|tap bai gi|tap gi|nen tap|tap the nao|workout|workouts|exercise|exercises|training|routine|lich tap|che do tap|hlv|huan luyen vien|coach|squat|deadlift|bench press|plank|cardio|hiit|calo|calorie|tdee|protein|creatine|whey|dinh duong|thuc don|bua an|an uong|meal|meals|giam mo|tang co|bulking|cutting|recomp|phuc hoi co|giao an tap)\b/;
const COMMON_FITNESS_LANGUAGE_PATTERN =
  /\b(?:progressive overload|hypertrophy|deload(?:ing)?|mesocycles?|supersets?|drop[ -]?sets?|amrap|1rm|vo2\s*max|calisthenics|powerlifting|bodybuilding|tempo reps?|muscle soreness|rpe|rir|doms|bulk(?:ing)?|cut(?:ting)?|full body|push pull legs|ppl|posterior chain|train(?:ing)? (?:legs?|chest|back|arms?|shoulders?|core|every day)|gain muscle|lose (?:fat|weight)|fat loss|weight loss|muscle gain|rest between sets?|training to failure|train to failure|tang can|giam can|siet co|tap (?:toi|den) that bai|nghi giua (?:hiep|set)|tang muc ta)\b/;
const AMBIGUOUS_FITNESS_LANGUAGE_PATTERN =
  /\b(?:macros?|mobility|periodi[sz]ation)\b/;
const NON_FITNESS_AMBIGUOUS_LANGUAGE_PATTERN =
  /\b(?:excel|vba|spreadsheet|programming|code|compiler|preprocessor)\b[\s\S]{0,40}\bmacros?\b|\bmacros?\b[\s\S]{0,40}\b(?:excel|vba|spreadsheet|programming|code|compiler|preprocessor)\b|\b(?:social|economic|occupational|upward|downward)\s+mobility\b|\bmobility\b[\s\S]{0,40}\b(?:society|social class|labor market)\b|\b(?:historical|history|lich su)\b[\s\S]{0,40}\bperiodi[sz]ation\b|\bperiodi[sz]ation\b[\s\S]{0,40}\b(?:historical|history|lich su)\b/;
const JOINT_EXERCISE_PATTERN =
  /\btap\s+(?:dau goi|khop goi|goi|khop vai|co tay|co chan)\b/;
const ACCENTED_INJURY_DOMAIN_PATTERN =
  /(?:^|\s)chấn thương(?=\s|$)/u;
const ASCII_INJURY_DOMAIN_PATTERN =
  /\b(?:bi|dang bi|sau|phuc hoi)\s+chan thuong\b/;
const ADJACENT_PATTERN =
  /\b(the thao|bong da|bong ro|chay bo|boi loi|yoga|giac ngu|ngu ngon|loi song|wellness)\b/;
const TIME_SENSITIVE_PATTERN =
  /\b(hom nay|bay gio|hien tai|moi nhat|gan day|nam nay|tuan nay|thang nay|sap toi|dang la|con la|current|currently|latest|today|this year|recently)\b/;
const IMPLICIT_TIME_SENSITIVE_PATTERN =
  /\b(thoi tiet|weather|(?:hien\s+)?bao nhieu tuoi|how old|choi cho|plays? for|current (?:club|team)|dang luu dien|touring|on tour|tour dates?|song o dau|lives? where)\b/;
const CURRENT_OFFICE_HOLDER_PATTERN =
  /\b(?:ai la|who is)\b[\s\S]{0,80}\b(?:tong thong|president|thu tuong|prime minister|ceo|chief executive officer|chu tich|chairperson|thi truong|mayor)\b|\b(?:tong thong|president|thu tuong|prime minister|ceo|chief executive officer|chu tich|chairperson|thi truong|mayor)\b[\s\S]{0,80}\b(?:la ai|who is)\b/;
const HISTORICAL_OFFICE_HOLDER_PATTERN =
  /\b(?:dau tien|first|former|cuu|tien nhiem|predecessor|vao nam|nam (?:18|19|20)\d{2}|in (?:18|19|20)\d{2}|thu \d+)\b/;
const LIVE_MARKET_VALUE_PATTERN =
  /\b(?:gia(?! tri\b)|price(?: of)?|ty gia|exchange rate|lai suat|interest rate)\b[\s\S]{0,80}\b(?:bao nhieu|how much|what is|usd|vnd|bitcoin|btc|ethereum|eth|vang|gold|xang|oil|co phieu|stock)\b/;
const HISTORICAL_MARKET_SNAPSHOT_PATTERN =
  /\b(?:vao nam|nam|in)\s+(?:18|19|20)\d{2}\b/;
const PUBLISHED_EVENT_RESULT_PATTERN =
  /\b(?:ai thang|ai vo dich|ai doat|who won|winner|ket qua|results?|ty so|score)\b[\s\S]{0,100}\b(?:oscar|grammy|world cup|champions league|premier league|nba|nfl|olympic|olympics|election|bau cu|giai thuong|award|final|chung ket|(?:19|20)\d{2})\b/;
const CURRENT_STANDINGS_PATTERN =
  /\b(?:dang\s+)?(?:dung|xep)\s+thu\s+(?:may|\d+)\b|\b(?:bang xep hang|standings?|league table|table position|current ranking)\b/;
const PERSONAL_DEICTIC_FITNESS_PATTERN =
  /\b(?:hom nay|today)\b[\s\S]{0,100}\b(?:nen tap|tap gi|tap (?:vai|nguc|chan|lung|tay|bung|co bung|mong)|workout|training|squat|deadlift|bench press|plank|cardio|hiit)\b|\b(?:toi|minh|em|my|i)\b[\s\S]{0,140}\b(?:hom nay|today)\b[\s\S]{0,100}\b(?:nen tap|tap gi|workout|training)\b/;
const PUBLIC_PERSON_DATE_OF_BIRTH_PATTERN =
  /\b(?:dob|date of birth|ngay sinh|sinh ngay|born)\b/;
const SOURCE_REQUEST_PATTERN =
  /\b(nguon|trich dan|citation|dan chung|bang chung|kiem chung|link bai|tai lieu tham khao|source|evidence)\b/;
const RESEARCH_CLAIM_PATTERN =
  /\b(nghien cuu|study|systematic review|meta analysis|meta-analysis|thong ke|bao nhieu phan tram)\b/;
const IDENTITY_QUERY_PATTERN = /\b(la ai|who is|gioi thieu ve)\b/;
const PUBLIC_PERSON_CLAIM_PATTERN =
  /\b(thuong tap|hay tap|co tap|tap nhung bai gi|tap bai gi|tap gi|tap may hiep|tap bao nhieu|tap gym|tap (?:squat|deadlift|bench press|plank|cardio|hiit)|yeu thich bai tap|bai tap yeu thich|routine|lich tap|che do tap|che do an|co dung (?:creatine|whey|protein|supplement)|an bao nhieu|an gi|ngu may tieng|ngu bao nhieu|thoi quen|thanh tich|vo dich|bao nhieu lan|(?:hien\s+)?bao nhieu tuoi|how old|phat ngon|noi gi ve|thuoc cong ty|dang thi dau|dang choi cho|choi cho|plays? for|current (?:club|team)|dang luu dien|touring|on tour|tour dates?|song o dau|lives? where|bi chan thuong|dang chan thuong|chan thuong gi|bi dau gi|ngat xiu|dot quy|dau nguc|kho tho|fainted|stroke|chest pain|shortness of breath)\b/;
const GENERIC_ROUTINE_SUBJECT_PATTERN =
  /^(?:ai|ban|toi|minh|em|i|bo toi|me toi|vo toi|chong toi|con toi|ban toi|anh toi|chi toi|em toi|my father|my mother|my wife|my husband|my child|my friend|nguoi moi|nguoi tap|hoc vien|khach hang|benh nhan|client|patient|customer|member|user|he|she|they|hlv|huan luyen vien|coach|ppl|push pull legs|van dong vien|cac van dong vien|cau thu|cac cau thu|trieu chung|dau hieu|vai|nguc|chan|lung|tay|bung|co bung|mong|nhom co|bai tap|tap chan|tap vai|tap nguc|tap lung|tap tay|squat|deadlift|bench press|plank|cardio|hiit|yoga|cach (?:tang|giam|siet)\b)(?:\b[\s\S]*)?$/;
const GENERIC_PERSON_QUERY_PREFIX_PATTERN =
  /^(?:(?:mot|cac|nhung)\s+)?(?:nguoi moi|nguoi tap|hoc vien|khach hang|benh nhan|client|patient|customer|member|user)\b/;
const GENERIC_PLANNING_REQUEST_PATTERN =
  /^(?:(?:(?:hay|vui long|co the)\s+)*(?:(?:giup|ho tro)(?:\s+(?:toi|minh|em))?\s+)?(?:tao|lap|xay dung|goi y|de xuat|lam|soan|thiet ke|viet|len)\s+(?:(?:giup|cho)(?:\s+(?:toi|minh|em))?\s+)?|(?:(?:cho\s+(?:toi|minh|em))|(?:(?:toi|minh|em)\s+(?:muon|can)))\s+)(?:mot\s+)?(?:lich tap|ke hoach|giao an|thuc don|bua an|meal plan)\b/;
const POLITE_QUERY_PREFIX_PATTERN =
  /^(?:(?:xin\s+)?(?:ban\s+)?cho\s+(?:toi|minh|em)\s+hoi|(?:toi|minh|em)\s+(?:muon\s+)?hoi|(?:xin\s+)?hoi)\s+/;
const KNOWLEDGE_QUERY_PREFIX_PATTERN =
  /^(?:(?:ban|anh|chi|bro)\s+)?(?:co\s+)?(?:biet|cho\s+(?:toi|minh|em)\s+biet)\s+/;
const PERSON_CLAIM_NOUN_PREFIX_PATTERN =
  /^(?:(?:nhung|cac|mot so)\s+)?(?:bai tap|workout|routine)(?:\s+(?:pho bien|yeu thich|hang ngay|thuong ngay))?(?:\s+(?:ma|cua))?\s*/;
const PERSON_TITLE_PREFIX_PATTERN =
  /^(?:cau thu|van dong vien|vdv|hlv|huan luyen vien|coach|ca si|dien vien)\s+/;
const POSSESSIVE_PUBLIC_PERSON_CLAIM_PATTERN =
  /\b(?:bai (?:tap|squat|deadlift|bench press|plank|cardio|hiit)|workout|routine|lich tap|che do tap|che do an|thoi quen)(?:\s+(?:pho bien|yeu thich|hang ngay|thuong ngay))?\s+cua\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,4}?)(?=\s+(?:la gi|gom|bao gom|nhu the nao|ra sao|co gi|the nao)\b|$)/;
const EXERCISE_ENTITY_PATTERN =
  /\b(?:squat|deadlift|press|row|pulldown|pull down|fly|curl|extension|raise|lunge|split squat|hip thrust|plank|crunch|sit up|push up|pull up|hit dat|keo xa|dip|carry|bridge|kickback|abduction|adduction|rotation|shrug|clean|snatch|swing|burpee|box jump|jump squat|leg press|leg curl|pec deck)\b/;
const EXERCISE_TECHNIQUE_PATTERN =
  /\b(cach (?:tap|thuc hien)|ky thuat|dung ky thuat|dung cach|huong dan|form chuan|bai tap cho|tim bai tap|tap nhom co)\b/;
const DIRECT_FITNESS_TECHNIQUE_PATTERN =
  /\b(?:cach tap\s+(?:dung\b|the nao|nhu nao|hit dat|push up|pull up|keo xa|squat|deadlift|bench press|plank|hip thrust|lunge|row)|ky thuat\s+(?:hit dat|push up|pull up|keo xa|squat|deadlift|bench press|plank|hip thrust|lunge|row)|tap\s+(?:vai|nguc|chan|lung|tay|bung|co bung|mong|dau goi|khop goi|goi)\s+(?:nhu nao|the nao))\b/;
const EXERCISE_LOOKUP_PATTERN =
  /\b(?:(?:vai|nguc|chan|lung|tay|bung|co bung|mong|ppl|push pull legs|nhom co|bai tap)\b[\s\S]{0,60}\b(?:tap|bai|exercise|workout)|tap\s+(?:vai|nguc|chan|lung|tay|bung|co bung|mong))\b/;
const TDEE_TOOL_PATTERN =
  /\b(tinh tdee|tdee cua toi|tdee|bmr|calo moi ngay|calorie needs?|an bao nhieu calo)\b/;
const MEAL_TOOL_PATTERN =
  /\b(thuc don|bua an|meal plan|meal|meals|goi y mon an|lich an)\b/;
const WALLET_TOOL_PATTERN =
  /\b(vi cua toi|vi toi|so du vi|lich su nap tien|nap tien|giao dich vi)\b/;
const CHECKIN_TOOL_PATTERN =
  /\b(check[ -]?in|lich su tap|tap duoc may buoi|goi tap con bao nhieu buoi|so buoi da tap)\b/;
const TRAINING_SCHEDULE_TOOL_PATTERN =
  /\b(hom nay tap may gio|lich tap (?:hom nay|tuan nay|cua toi)|giao an hom nay|lich trinh tap luyen ca nhan)\b/;
const WORKOUT_PLAN_TOOL_PATTERN =
  /\b(giao an (?:cua toi|gan nhat)|chuong trinh tap cua toi|bai tap hom nay)\b/;
const TRAINER_TOOL_PATTERN =
  /\b(hlv|huan luyen vien|tim pt|ai kem tap|doi ngu htcoaching)\b/;
const GYM_INFO_TOOL_PATTERN =
  /\b(phong tap|dia chi (?:gym|phong tap)|gio mo cua (?:gym|phong tap)|tim gym)\b/;
const BLOG_TOOL_PATTERN =
  /\b(bai viet|blog|doc them ve)\b/;
const TDEE_ACTION_PATTERN =
  /\b(?:tinh|uoc tinh|calculate|estimate)\b[\s\S]{0,80}\b(?:tdee|bmr|calo|calorie)|\b(?:tdee|bmr|calo moi ngay|calorie needs?)\b[\s\S]{0,40}\b(?:cua toi|cua minh|cho toi|cho minh|my|for me)\b/;
const MEAL_ACTION_PATTERN =
  /\b(?:goi y|tao|lap|xay dung|de xuat|suggest|create|build|make)\b[\s\S]{0,80}\b(?:thuc don|bua an|meal plan|meals?)\b|\b(?:thuc don|bua an|meal plan)\b[\s\S]{0,40}\b(?:cua toi|cua minh|cho toi|cho minh|my|for me)\b/;
const TDEE_MEAL_TOOL_SEQUENCE = Object.freeze([
  "calculate_tdee",
  "suggest_meal",
]);
const ALWAYS_CANONICAL_INTERNAL_TOOLS = new Set([
  "check_wallet",
  "get_checkin_history",
  "get_training_schedule",
  "get_workout_plan",
  "get_trainer_info",
  "get_gym_info",
]);
const HIGH_STAKES_PATTERN =
  /\b(chan doan|ke don|lieu thuoc|don thuoc|dau nguc|kho tho|ngat xiu|dot quy|co giat|tu tu|tu sat|tu hai|ket lieu|mang thai|benh than|suy than|benh tim|tim mach|huyet ap|tieu duong|ung thu|hiv|aids|hen suyen|diagnos(?:e|ed|is)|prescri(?:be|ption)|medication|chest pain|shortness of breath|faint(?:ed|ing)?|stroke|heart attack|seizure|overdose|suicid(?:e|al)|self harm|kill myself|hurt myself|end my life|take my life|pregnan(?:t|cy)|kidney disease|heart disease|blood pressure|diabetes|cancer|hiv|aids|asthma|injur(?:y|ed)|pain)\b/;
const DIRECT_SELF_HARM_URGENCY_PATTERN =
  /\b(?:toi|minh|em|tui|i)\b\s+(?:(?:dang|vua|se|co the|am|is|are|going to|plan to|might)\s+){0,4}(?:khong(?: con)? muon song|muon (?:tu tu|tu sat|tu hai|ket lieu|chet)|tu tu|tu sat|tu hai|ket lieu|kill myself|hurt myself|end my life|take my life|want to die|self harm|suicidal|overdose(?: myself)?|do not want to live(?: anymore)?)\b/;
const CLOSE_PERSON_SELF_HARM_URGENCY_PATTERN =
  /\b(?:ban toi|bo toi|me toi|vo toi|chong toi|con toi|anh toi|chi toi|em toi|nguoi ben canh toi|my friend|my father|my mother|my wife|my husband|my child|someone next to me)\b\s+(?:(?:dang|vua|se|co the|is|are|was|were|going to|plans? to|might)\s+){0,4}(?:muon (?:tu tu|tu sat|tu hai|ket lieu|chet)|tu tu|tu sat|tu hai|ket lieu|wants? to die|suicidal|self harm)\b/;
const NEGATED_SELF_HARM_INTENT_PATTERN =
  /\b(?:toi|minh|em|tui|i)\b\s+(?:chua bao gio|khong|never|do not|don t)\s+(?:(?:muon|want(?:ed)? to)\s+)?(?:tu tu|tu sat|tu hai|ket lieu|chet|die|kill myself|hurt myself|end my life|take my life|self harm)\b/;
const MEDICAL_EMERGENCY_SOURCE =
  "(?:dau nguc|kho tho|khong (?:the )?tho duoc|khong tho noi|sap ngat|ngat xiu|ngat|dot quy|co giat|len con hen|chest pain|shortness of breath|cannot breathe|can t breathe|about to faint|faint(?:ed|ing)?|stroke|heart attack|seizure|asthma attack)";
const MEDICAL_EMERGENCY_PATTERN = new RegExp(
  `\\b${MEDICAL_EMERGENCY_SOURCE}\\b`,
);
const DIRECT_MEDICAL_EMERGENCY_PATTERN = new RegExp(
  `\\b(?:toi|minh|em|tui|i|nguoi ben canh toi|mot nguoi|bo toi|me toi|vo toi|chong toi|con toi|ban toi|anh toi|chi toi|em toi|someone next to me|someone|my father|my mother|my wife|my husband|my child|my friend)\\b\\s+(?:(?:dang|vua|moi|sap|cam thay|bi|co|am|is|are|was|were|just|have|has|having|about to)\\s+){0,4}(?:a\\s+)?${MEDICAL_EMERGENCY_SOURCE}\\b`,
);
const HISTORICAL_MEDICAL_PATTERN =
  /\b(tung|truoc day|nam (?:19|20)\d{2}|previously|in (?:19|20)\d{2})\b/;
const CURRENT_MEDICAL_EMERGENCY_PATTERN = new RegExp(
  `\\b(?:dang|vua|moi|hom nay|bay gio|gio|hien tai|hien gio|luc nay|currently|just|today|now)\\b(?:\\s+[a-z0-9_-]+){0,4}\\s+${MEDICAL_EMERGENCY_SOURCE}\\b`,
);
const IMMINENT_FAINT_URGENCY_PATTERN =
  /\bi\s+(?:feel|felt|am)\s+dizzy(?:\s+and)?\s+(?:i\s+)?(?:am\s+)?about to faint\b|\b(?:toi|minh|em)\s+(?:cam thay\s+)?chong mat\s+va\s+sap ngat\b/;
const NON_MEDICAL_STROKE_PATTERN =
  /\b(?:freestyle|swimming|swim|golf|tennis|rowing)\s+stroke\b|\bstroke\s+(?:technique|form|rate)\b/g;
const ACCENTED_PAIN_OR_INJURY_PATTERN =
  /(?:^|\s)(?:đau|chấn thương)(?=\s|$)/u;
const ASCII_PAIN_OR_INJURY_CONTEXT_PATTERN =
  /\b(?:bi|dang bi|cam thay|co trieu chung|sau|phuc hoi|tranh|ngan ngua)\s+(?:dau|chan thuong)\b|\bdau\s+(?:dau|nguc|goi|lung|vai|co|bung|hong|chan|tay)\b|\bchan thuong\s+(?:dau|goi|lung|vai|co|chan|tay|khi|do)\b/;
const PREGNANCY_CONTEXT_PATTERN =
  /\bba bau\b|\bbau\s+(?:nen|co the|tap|the nao|nhu nao)\b/;
const MEDICAL_ROUTINE_SUBJECT_PATTERN =
  /^(?:(?:nguoi|nguoi bi|nguoi mac|benh nhan|patient)\s+)?(?:hiv|aids|tieu duong|ung thu|hen suyen|huyet ap|benh\b|dau\b|chan thuong\b|mang thai\b|ba bau\b|bau\b)/;
const DISALLOWED_PATTERN =
  /\b(tiet lo|hien thi|dua toi|cho toi xem|bo qua (?:quy tac|policy|luat))\b[\s\S]{0,80}\b(system prompt|instruction noi bo|gemini_api_key|api key|secret|token|cookie)\b|\b(huong dan lam bom|che tao bom|danh cap mat khau|hack tai khoan)\b/;
const CONTEXTUAL_FOLLOW_UP_PATTERN =
  /^(?:còn(?:\s+(?:bài|gì|cách|món|loại|lựa chọn|nào|thêm))?|thế còn|vậy còn|ngoài ra|nói thêm|gợi ý thêm|có (?:bài|cách|món|gì) nào khác|bài nào khác)\b/u;
const ASCII_CONTEXTUAL_FOLLOW_UP_PATTERN =
  /^(?:con\s+(?:bai|gi|cach|mon|loai|lua chon|nao|them)|the con|vay con|ngoai ra|noi them|goi y them|co (?:bai|cach|mon|gi) nao khac|bai nao khac|what else|any other|tell me more)\b/;
const MAX_CONTEXTUAL_QUERY_CHARACTERS = 500;
const MAX_FOLLOW_UP_CHARACTERS = 240;

const stripDiacritics = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const normalizeMessage = (message, maxCharacters = MAX_SAFETY_MESSAGE_CHARACTERS) =>
  stripDiacritics(String(message ?? "").slice(0, maxCharacters))
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMessageWithDiacritics = (
  message,
  maxCharacters = MAX_SAFETY_MESSAGE_CHARACTERS,
) =>
  String(message ?? "")
    .slice(0, maxCharacters)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeAsciiRiskText = (normalizedWithDiacritics) =>
  stripDiacritics(
    normalizedWithDiacritics
      .replaceAll("đầu gối", "khop_goi")
      .replaceAll("ở đâu", "vi_tri"),
  );

const maskNonMedicalStrokePhrases = (value) =>
  String(value || "").replace(NON_MEDICAL_STROKE_PATTERN, "non_medical_stroke");

/**
 * Gắn một follow-up ngắn với user turn gần nhất để router và retrieval không
 * đánh mất chủ đề. Chỉ dùng nội dung user, có giới hạn và không lưu query này
 * vào trace/log.
 */
export function buildStandaloneRetrievalQuery(message, priorMessages = []) {
  const current = String(message ?? "")
    .trim()
    .slice(0, MAX_RETRIEVAL_QUERY_CHARACTERS);
  if (!current || current.length > MAX_FOLLOW_UP_CHARACTERS) return current;

  const normalized = normalizeMessage(current);
  const normalizedWithDiacritics = normalizeMessageWithDiacritics(current);
  if (
    !CONTEXTUAL_FOLLOW_UP_PATTERN.test(normalizedWithDiacritics) &&
    !ASCII_CONTEXTUAL_FOLLOW_UP_PATTERN.test(normalized)
  ) {
    return current;
  }

  const previousUserMessage = [...(Array.isArray(priorMessages) ? priorMessages : [])]
    .reverse()
    .find(
      (item) =>
        item?.role === "user" &&
        typeof item.content === "string" &&
        item.content.trim(),
    );
  if (!previousUserMessage) return current;

  const availablePreviousCharacters = Math.max(
    0,
    MAX_CONTEXTUAL_QUERY_CHARACTERS - current.length - 1,
  );
  const previous = previousUserMessage.content
    .trim()
    .slice(0, availablePreviousCharacters);
  return previous ? `${previous}\n${current}` : current;
}

const stripPoliteQueryPrefix = (value) => {
  let result = value;
  let previous;
  do {
    previous = result;
    result = result.replace(POLITE_QUERY_PREFIX_PATTERN, "").trim();
  } while (result !== previous);
  return result;
};

const normalizePersonCandidate = (value) => {
  let candidate = stripPoliteQueryPrefix(value)
    .replace(KNOWLEDGE_QUERY_PREFIX_PATTERN, "")
    .trim();
  const relativeSegments = candidate.split(/\b(?:ma|rang)\b/);
  candidate = relativeSegments[relativeSegments.length - 1]
    .replace(PERSON_CLAIM_NOUN_PREFIX_PATTERN, "")
    .replace(/^\b(?:ve|cua|con)\b\s*/, "")
    .replace(PERSON_TITLE_PREFIX_PATTERN, "")
    .replace(/\b(?:vua|dang|da|moi|co|just|currently)\s*$/g, "")
    .replace(/\b(?:ve|cua|con)\s*$/g, "")
    .trim();
  return candidate;
};

const isLikelyPersonCandidate = (candidate) => {
  if (!candidate || GENERIC_ROUTINE_SUBJECT_PATTERN.test(candidate)) return false;
  if (MEDICAL_ROUTINE_SUBJECT_PATTERN.test(candidate)) return false;
  if (EXERCISE_ENTITY_PATTERN.test(candidate)) return false;
  const tokens = candidate.split(/\s+/).filter(Boolean);
  return tokens.length >= 1 && tokens.length <= 5;
};

const hasLikelyNamedPerson = (normalizedMessage, domain) => {
  if (domain === "ht_service") return false;
  const routedText = stripPoliteQueryPrefix(normalizedMessage);
  if (GENERIC_PERSON_QUERY_PREFIX_PATTERN.test(routedText)) return false;
  if (GENERIC_PLANNING_REQUEST_PATTERN.test(routedText)) return false;
  const possessiveMatch = routedText.match(
    POSSESSIVE_PUBLIC_PERSON_CLAIM_PATTERN,
  );
  if (possessiveMatch?.[1]) {
    const possessor = normalizePersonCandidate(possessiveMatch[1]);
    if (isLikelyPersonCandidate(possessor)) return true;
  }
  const predicateMatch = routedText.match(
    new RegExp(`${IDENTITY_QUERY_PATTERN.source}|${PUBLIC_PERSON_CLAIM_PATTERN.source}`),
  );
  if (!predicateMatch || predicateMatch.index === undefined) return false;

  const subject = normalizePersonCandidate(
    routedText.slice(0, predicateMatch.index),
  );
  return isLikelyPersonCandidate(subject);
};

const inferDomain = (normalizedMessage, normalizedWithDiacritics) => {
  if (
    HT_SERVICE_PATTERN.test(normalizedMessage) ||
    ACCENTED_HT_PACKAGE_PATTERN.test(normalizedWithDiacritics) ||
    ASCII_HT_PACKAGE_CONTEXT_PATTERN.test(normalizedMessage)
  ) {
    return "ht_service";
  }
  if (
    FITNESS_PATTERN.test(normalizedMessage) ||
    COMMON_FITNESS_LANGUAGE_PATTERN.test(normalizedMessage) ||
    (AMBIGUOUS_FITNESS_LANGUAGE_PATTERN.test(normalizedMessage) &&
      !NON_FITNESS_AMBIGUOUS_LANGUAGE_PATTERN.test(normalizedMessage)) ||
    DIRECT_FITNESS_TECHNIQUE_PATTERN.test(normalizedMessage) ||
    JOINT_EXERCISE_PATTERN.test(normalizedMessage) ||
    ACCENTED_INJURY_DOMAIN_PATTERN.test(normalizedWithDiacritics) ||
    ASCII_INJURY_DOMAIN_PATTERN.test(normalizedMessage)
  ) {
    return "fitness";
  }
  if (ADJACENT_PATTERN.test(normalizedMessage)) return "adjacent";
  return "general";
};

const freezeDecision = (decision) => Object.freeze(decision);

/**
 * Phân loại request bằng rule bounded trước khi LLM hoặc retrieval được gọi.
 * Decision không chứa raw message để có thể log/trace an toàn nếu cần.
 */
export function routeAiRequest(message, { contextualQuery = message } = {}) {
  const normalized = normalizeMessage(
    contextualQuery,
    MAX_RETRIEVAL_QUERY_CHARACTERS,
  );
  const normalizedWithDiacritics = normalizeMessageWithDiacritics(
    contextualQuery,
    MAX_RETRIEVAL_QUERY_CHARACTERS,
  );
  const safetyNormalized = normalizeMessage(
    message,
    MAX_SAFETY_MESSAGE_CHARACTERS,
  );
  const safetyWithDiacritics = normalizeMessageWithDiacritics(
    message,
    MAX_SAFETY_MESSAGE_CHARACTERS,
  );
  const asciiRiskText = normalizeAsciiRiskText(safetyWithDiacritics);
  const medicalRiskText = maskNonMedicalStrokePhrases(safetyNormalized);
  const domain = inferDomain(normalized, normalizedWithDiacritics);
  const namedPerson = hasLikelyNamedPerson(normalized, domain);
  const boundedSafetyMessage = String(message ?? "").slice(
    0,
    MAX_SAFETY_MESSAGE_CHARACTERS,
  );
  const boundedContextualQuery = String(contextualQuery ?? "").slice(
    0,
    MAX_RETRIEVAL_QUERY_CHARACTERS,
  );
  const contextualPublicPersonNames = getPublicPersonLookupNames(
    boundedContextualQuery,
  );
  const safetyPublicPersonNames = getPublicPersonLookupNames(
    boundedSafetyMessage,
  );
  const safetyPersonalHealth = containsPersonalHealthData(
    boundedSafetyMessage,
  );
  const contextualPersonalHealth =
    boundedContextualQuery !== boundedSafetyMessage &&
    containsPersonalHealthData(boundedContextualQuery);
  const safetyPublicDateOfBirth =
    safetyPersonalHealth &&
    isCallerVettedPublicDateOfBirth(
      boundedSafetyMessage,
      safetyPublicPersonNames,
    );
  const contextualPublicDateOfBirth =
    contextualPersonalHealth &&
    isCallerVettedPublicDateOfBirth(
      boundedContextualQuery,
      contextualPublicPersonNames,
    );
  const safetyVettedPublicPersonClaim =
    safetyPersonalHealth &&
    isCallerVettedPublicPersonClaim(
      boundedSafetyMessage,
      safetyPublicPersonNames,
    );
  const contextualVettedPublicPersonClaim =
    contextualPersonalHealth &&
    isCallerVettedPublicPersonClaim(
      boundedContextualQuery,
      contextualPublicPersonNames,
    );
  // DOB là dữ liệu định danh nhạy cảm mặc định. Chỉ nhánh đã được privacy
  // resolver bind với exact public identity mới được phép đi tiếp tới web;
  // tên khách hàng/người thân/identity mơ hồ vẫn fail-closed.
  const personalHealth =
    (safetyPersonalHealth &&
      !safetyPublicDateOfBirth &&
      !safetyVettedPublicPersonClaim) ||
    (contextualPersonalHealth &&
      !contextualPublicDateOfBirth &&
      !contextualVettedPublicPersonClaim);
  const dateOfBirthLookupIntent =
    PUBLIC_PERSON_DATE_OF_BIRTH_PATTERN.test(normalized);
  const publicPersonDateOfBirthClaim =
    !personalHealth &&
    contextualPublicPersonNames.length > 0 &&
    dateOfBirthLookupIntent &&
    (!contextualPersonalHealth || contextualPublicDateOfBirth);
  const privatePersonDateOfBirthLookup =
    !personalHealth &&
    dateOfBirthLookupIntent &&
    contextualPublicPersonNames.length === 0 &&
    prepareExternalKnowledgeQuery(boundedContextualQuery, {
      allowedPublicPersonNames: contextualPublicPersonNames,
    }).reason === "ambiguous_person_identity";
  const selfHarmUrgency =
    !NEGATED_SELF_HARM_INTENT_PATTERN.test(safetyNormalized) &&
    (DIRECT_SELF_HARM_URGENCY_PATTERN.test(safetyNormalized) ||
      CLOSE_PERSON_SELF_HARM_URGENCY_PATTERN.test(safetyNormalized));
  const medicalEmergency =
    MEDICAL_EMERGENCY_PATTERN.test(medicalRiskText) &&
    (DIRECT_MEDICAL_EMERGENCY_PATTERN.test(medicalRiskText) ||
      IMMINENT_FAINT_URGENCY_PATTERN.test(medicalRiskText) ||
      (personalHealth &&
        (!HISTORICAL_MEDICAL_PATTERN.test(safetyNormalized) ||
          CURRENT_MEDICAL_EMERGENCY_PATTERN.test(medicalRiskText))));
  const urgency = selfHarmUrgency
    ? "self_harm"
    : medicalEmergency
      ? "medical_emergency"
      : null;
  const implicitlyVolatileFact =
    (CURRENT_OFFICE_HOLDER_PATTERN.test(normalized) &&
      !HISTORICAL_OFFICE_HOLDER_PATTERN.test(normalized)) ||
    (LIVE_MARKET_VALUE_PATTERN.test(normalized) &&
      !HISTORICAL_MARKET_SNAPSHOT_PATTERN.test(normalized)) ||
    PUBLISHED_EVENT_RESULT_PATTERN.test(normalized) ||
    CURRENT_STANDINGS_PATTERN.test(normalized);
  const freshness =
    TIME_SENSITIVE_PATTERN.test(normalized) ||
    IMPLICIT_TIME_SENSITIVE_PATTERN.test(normalized) ||
    implicitlyVolatileFact
    ? "time_sensitive"
    : "stable";
  const risk = urgency
    ? "high_stakes"
    : DISALLOWED_PATTERN.test(safetyNormalized)
    ? "disallowed"
    : HIGH_STAKES_PATTERN.test(medicalRiskText) ||
        ACCENTED_PAIN_OR_INJURY_PATTERN.test(safetyWithDiacritics) ||
        ASCII_PAIN_OR_INJURY_CONTEXT_PATTERN.test(asciiRiskText) ||
        PREGNANCY_CONTEXT_PATTERN.test(safetyNormalized) ||
        personalHealth
      ? "high_stakes"
      : "low";
  const identityQuery = IDENTITY_QUERY_PATTERN.test(normalized);
  const publicPersonClaim =
    publicPersonDateOfBirthClaim ||
    (!personalHealth &&
      namedPerson &&
      (PUBLIC_PERSON_CLAIM_PATTERN.test(normalized) ||
        POSSESSIVE_PUBLIC_PERSON_CLAIM_PATTERN.test(normalized)));
  const explicitEvidence = SOURCE_REQUEST_PATTERN.test(normalized);
  const researchClaim = RESEARCH_CLAIM_PATTERN.test(normalized);
  const exerciseTechnique =
    domain === "fitness" &&
    !publicPersonClaim &&
    (EXERCISE_TECHNIQUE_PATTERN.test(normalized) ||
      DIRECT_FITNESS_TECHNIQUE_PATTERN.test(normalized) ||
      EXERCISE_LOOKUP_PATTERN.test(normalized) ||
      JOINT_EXERCISE_PATTERN.test(normalized) ||
      EXERCISE_ENTITY_PATTERN.test(normalized));
  const preferredInternalTool =
    risk === "disallowed" || risk === "high_stakes" || publicPersonClaim
    ? null
    : WALLET_TOOL_PATTERN.test(normalized)
      ? "check_wallet"
      : CHECKIN_TOOL_PATTERN.test(normalized)
        ? "get_checkin_history"
        : TRAINING_SCHEDULE_TOOL_PATTERN.test(normalized)
          ? "get_training_schedule"
          : WORKOUT_PLAN_TOOL_PATTERN.test(normalized)
            ? "get_workout_plan"
            : TDEE_TOOL_PATTERN.test(normalized)
              ? "calculate_tdee"
              : MEAL_TOOL_PATTERN.test(normalized)
                ? "suggest_meal"
                : TRAINER_TOOL_PATTERN.test(normalized)
                  ? "get_trainer_info"
                  : GYM_INFO_TOOL_PATTERN.test(normalized)
                    ? "get_gym_info"
                    : BLOG_TOOL_PATTERN.test(normalized)
                      ? "search_blog"
                       : exerciseTechnique
                         ? "search_exercises"
                         : null;
  // Content tools là evidence ổn định mặc định, nhưng không được lấn át yêu
  // cầu nguồn/nghiên cứu/freshness rõ ràng. Action cá nhân và dữ liệu
  // HTCOACHING canonical vẫn phải ở server thay vì externalize sang web.
  const preferredToolIsCanonicalAction =
    ALWAYS_CANONICAL_INTERNAL_TOOLS.has(preferredInternalTool) ||
    (preferredInternalTool === "calculate_tdee" &&
      TDEE_ACTION_PATTERN.test(normalized)) ||
    (preferredInternalTool === "suggest_meal" &&
      MEAL_ACTION_PATTERN.test(normalized));
  const canOverrideInternalToolWithWebEvidence =
    Boolean(preferredInternalTool) && !preferredToolIsCanonicalAction;
  const tdeeMealCompoundAction =
    preferredInternalTool === "calculate_tdee" &&
    TDEE_ACTION_PATTERN.test(normalized) &&
    MEAL_ACTION_PATTERN.test(normalized);
  const personalDeicticFitness =
    domain === "fitness" &&
    !publicPersonClaim &&
    PERSONAL_DEICTIC_FITNESS_PATTERN.test(normalized);
  const needsWebEvidence =
    risk !== "disallowed" &&
    (!preferredInternalTool || canOverrideInternalToolWithWebEvidence) &&
    domain !== "ht_service" &&
    (publicPersonClaim ||
      privatePersonDateOfBirthLookup ||
      (risk !== "high_stakes" &&
        (explicitEvidence ||
          researchClaim ||
          (freshness === "time_sensitive" && !personalDeicticFitness))));

  let evidence = "model_prior";
  if (urgency) evidence = "model_prior";
  else if (needsWebEvidence) evidence = "web_required";
  else if (risk === "high_stakes") evidence = "model_prior";
  else if (preferredInternalTool) evidence = "internal_kb";
  else if (domain === "ht_service" || domain === "fitness") {
    evidence = "internal_kb";
  }
  const webSearchRequired = evidence === "web_required";
  const knowledgeBaseEligible =
    evidence === "internal_kb" &&
    (domain === "ht_service" || domain === "fitness");

  const reasonCodes = [];
  if (freshness === "time_sensitive") reasonCodes.push("time_sensitive");
  if (explicitEvidence) reasonCodes.push("source_requested");
  if (researchClaim) reasonCodes.push("research_claim");
  if (publicPersonClaim) reasonCodes.push("public_person_claim");
  if (privatePersonDateOfBirthLookup) {
    reasonCodes.push("private_person_dob_lookup");
  }
  if (personalDeicticFitness) reasonCodes.push("personal_deictic_fitness");
  if (urgency) reasonCodes.push(`urgent_${urgency}`);
  if (risk === "high_stakes" && !publicPersonClaim) {
    reasonCodes.push("high_stakes_no_externalization");
  }
  if (exerciseTechnique) reasonCodes.push("exercise_technique");
  if (tdeeMealCompoundAction) reasonCodes.push("compound_tdee_meal");
  if (reasonCodes.length === 0) reasonCodes.push(`${domain}_stable`);

  return freezeDecision({
    schemaVersion: 1,
    domain,
    freshness,
    evidence,
    risk,
    urgency,
    knowledgeBaseEligible,
    webSearchRequired,
    preferredTool: webSearchRequired
      ? "search_knowledge"
      : preferredInternalTool,
    maxWebSearchCalls: webSearchRequired ? 1 : 0,
    entityResolution:
      identityQuery && namedPerson ? "transparent_assumption" : "not_applicable",
    reasonCodes: Object.freeze(reasonCodes),
  });
}

export function getAllowedToolNamesForRoute(decision) {
  if (!isValidDecision(decision)) return Object.freeze([]);
  if (decision.risk === "disallowed" || decision.evidence === "model_prior") {
    return Object.freeze([]);
  }
  if (decision.webSearchRequired) return Object.freeze(["search_knowledge"]);
  if (
    decision.preferredTool === "calculate_tdee" &&
    decision.reasonCodes?.includes("compound_tdee_meal")
  ) {
    return TDEE_MEAL_TOOL_SEQUENCE;
  }
  if (decision.preferredTool) return Object.freeze([decision.preferredTool]);
  if (decision.domain === "ht_service") {
    return Object.freeze(["get_trainer_info", "get_gym_info", "search_blog"]);
  }
  if (decision.domain === "fitness") {
    return Object.freeze(["search_exercises", "search_blog"]);
  }
  return Object.freeze([]);
}

const isValidDecision = (decision) =>
  Boolean(decision) &&
  decision.schemaVersion === 1 &&
  DOMAIN_VALUES.has(decision.domain) &&
  FRESHNESS_VALUES.has(decision.freshness) &&
  EVIDENCE_VALUES.has(decision.evidence) &&
  RISK_VALUES.has(decision.risk) &&
  URGENCY_VALUES.has(decision.urgency ?? null);

export function getUrgentSafetyResponse(decision) {
  if (decision?.urgency === "medical_emergency") {
    return "Nếu bạn đang đau ngực, khó thở, ngất xỉu hoặc có dấu hiệu đột quỵ: hãy dừng tập ngay và gọi cấp cứu địa phương, hoặc nhờ người gần đó gọi giúp. Đừng tự lái xe, đừng tập tiếp và đừng chờ thêm phản hồi qua chat.";
  }
  if (decision?.urgency === "self_harm") {
    return "Mình rất tiếc vì bạn đang phải đối mặt với điều này. Đừng ở một mình: hãy đến cạnh một người bạn tin cậy và đặt xa các vật có thể gây hại. Nếu bạn có thể hành động ngay, đã có kế hoạch hoặc phương tiện, hãy gọi cấp cứu hay đường dây hỗ trợ khủng hoảng tại nơi bạn sống ngay bây giờ. Chat không thay thế hỗ trợ khẩn cấp.";
  }
  return null;
}

/**
 * Chuyển decision server-side thành instruction tĩnh, không nội suy raw user data.
 */
export function buildRequestRoutingBlock(
  decision,
  { canUseWebSearch = false } = {},
) {
  if (!isValidDecision(decision)) return "";

  const lines = [
    "## ROUTING CHO YÊU CẦU HIỆN TẠI — QUYẾT ĐỊNH TỪ SERVER",
    `- domain=${decision.domain}; freshness=${decision.freshness}; evidence=${decision.evidence}; risk=${decision.risk}.`,
    "- Quyết định này chỉ điều phối nguồn dữ kiện; không làm thay đổi safety, privacy hoặc quyền gọi function.",
  ];

  if (decision.risk === "disallowed") {
    lines.push("- Từ chối ngắn gọn phần yêu cầu không an toàn; không gọi function.");
  } else if (decision.evidence === "web_required") {
    if (canUseWebSearch) {
      lines.push(
        "- Yêu cầu này BẮT BUỘC tra cứu bằng search_knowledge trước khi trả lời; gọi web search tối đa đúng 1 lần.",
        "- Chỉ khẳng định những gì nguồn hỗ trợ. Thư viện bài tập không chứng minh thói quen hoặc thành tích của người thật.",
        "- Nếu tra cứu lỗi, thiếu nguồn hoặc nguồn không đủ rõ: nói chưa thể xác minh; không fallback sang trí nhớ model để khẳng định.",
      );
    } else {
      lines.push(
        "- Web search không khả dụng cho actor này. Hãy nói rõ hiện không thể xác minh thông tin được hỏi.",
        "- Với claim đang cần nguồn: không được dùng trí nhớ model để khẳng định; có thể đề nghị user đăng nhập hoặc hỏi một nội dung ổn định khác.",
      );
    }
  } else if (decision.evidence === "internal_kb") {
    lines.push(
      "- Ưu tiên dữ kiện Knowledge Base/canonical tool đã được cung cấp; không gọi web search.",
    );
    if (decision.domain === "fitness" && decision.risk === "low") {
      lines.push(
        "- Nếu Knowledge Base hoặc catalog không có kết quả, vẫn trả lời bằng kiến thức fitness phổ thông an toàn; nói rõ đây là gợi ý chung và không giả vờ đã tìm thấy dữ liệu nội bộ.",
      );
    }
    if (decision.preferredTool === "search_exercises") {
      lines.push(
        "- Dùng search_exercises cho kỹ thuật hoặc danh mục bài tập. Không dùng kết quả đó làm bằng chứng về routine của người thật.",
      );
    }
  } else if (decision.risk === "high_stakes") {
    lines.push(
      "- Không có nguồn nội bộ phù hợp cho yêu cầu sức khỏe này và không gửi nội dung đó sang web search.",
      "- Chỉ trả lời giáo dục chung, nêu rõ giới hạn/độ không chắc chắn và ưu tiên khuyên gặp chuyên gia phù hợp.",
    );
  } else {
    lines.push(
      "- Đây là câu hỏi general ổn định: trả lời trực tiếp, ngắn gọn; không gọi Knowledge Base hoặc web search.",
      "- Nếu tên có một cách hiểu phổ biến, nêu giả định minh bạch rồi trả lời; chỉ hỏi lại khi nhiều khả năng ngang nhau.",
      "- Không ép liên hệ sang fitness hoặc chèn CTA HTCOACHING khi không liên quan.",
    );
  }

  if (decision.risk === "high_stakes") {
    lines.push(
      "- Chỉ cung cấp thông tin giáo dục, nêu giới hạn và khuyên gặp chuyên gia phù hợp; không chẩn đoán hoặc kê đơn.",
    );
  }
  if (decision.urgency === "medical_emergency") {
    lines.push(
      "- Đây có thể là tình huống cấp cứu: yêu cầu người dùng dừng tập ngay, gọi cấp cứu địa phương hoặc đến cơ sở y tế; không đưa giáo án tập.",
    );
  } else if (decision.urgency === "self_harm") {
    lines.push(
      "- Đây có thể là nguy cơ tự hại: khuyên không ở một mình, ở cạnh người tin cậy và gọi cấp cứu; không đưa hướng dẫn có thể gây hại.",
    );
  }

  return `\n\n${lines.join("\n")}`;
}
