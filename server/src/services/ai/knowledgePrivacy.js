import crypto from "crypto";

import {
  containsDateOfBirthInformation,
  containsHealthInformation,
  containsPersonalHealthData,
  extractNamedPersonalHealthSubjects,
  splitHealthClauses,
} from "./personalHealthData.js";
import { hasKnowledgeSourceCredentialParameters } from "../../utils/knowledgeBase.js";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;
const INTERNATIONAL_PHONE_PATTERN =
  /(?<![\w+])\+\d{1,3}(?:[\s().-]?\d){7,14}(?!\w)/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>{}\[\]]+/gi;
const LONG_IDENTIFIER_PATTERN = /(?<!\d)\d{9,16}(?!\d)/g;
const LABELED_IDENTIFIER_PATTERN =
  /\b(?:(?:passport|cccd|cmnd)(?:\s+(?:number|no|id|code))?|(?:account|member|user)\s+(?:id|code)|(?:ma|mã)\s+(?:tai khoan|tài khoản|thanh vien|thành viên|nguoi dung|người dùng))\s*[:=#-]?\s*[a-z0-9][a-z0-9_-]{2,63}\b/giu;
const SECRET_PATTERN = /\b(?:bearer\s+|api[_ -]?key\s*[:=]?\s*|token\s*[:=]?\s*)[a-z0-9._~+/=-]{8,}\b/gi;
const CREDENTIAL_ASSIGNMENT_PATTERN =
  /(?:^|[?&#;\s])(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth(?:orization)?[_-]?token|api[_-]?key|password|passwd|secret|session[_-]?(?:id|token))\s*[:=]\s*[^\s&#,;]{4,}/gi;
const ADDRESS_PATTERN =
  /\b(?:(?:địa chỉ|dia chi)\s*(?:của tôi|cua toi)?\s*[:=]?|(?:my|our|home|residential|billing|shipping)\s+address(?:\s+is)?|address\s*[:=])\s*[^,;\n]{5,120}/giu;
const PRIVATE_RECORD_LABEL_SOURCE =
  "(?:[Kk]hách hàng|[Hh]ọc viên|[Bb]ệnh nhân|[Cc]lient|[Pp]atient|[Cc]ustomer|[Mm]ember|[Uu]ser)";
const PRIVATE_NAME_PREDICATE_SOURCE =
  "(?:thường|hay|hỏi|muốn|đang|vừa|đã|bị|có|nên|cần|tập|uống|dùng|asks?|wants?|needs?|is|was|has|had|receiv(?:e|es|ing)|takes?|uses?|trains?)";
const PRIVATE_NAME_RESERVED_TOKEN_SOURCE =
  "(?:của|cua|tôi|toi|mình|minh|em|chúng|chung|my|mine|our|ours|should|do|does|follow)";
const PRIVATE_NAME_TOKEN_SOURCE =
  `(?!(?:${PRIVATE_NAME_PREDICATE_SOURCE}|${PRIVATE_NAME_RESERVED_TOKEN_SOURCE})\\b)\\p{L}[\\p{L}'’-]*`;
const EXPLICIT_NAME_VALUE_TOKEN_SOURCE =
  `(?!(?:${PRIVATE_NAME_PREDICATE_SOURCE}|${PRIVATE_NAME_RESERVED_TOKEN_SOURCE}|and|va|và|but|nhung|nhưng)\\b)[\\p{L}\\p{M}\\p{N}_'’-]{2,64}`;
const CONTEXTUAL_PRIVATE_NAME_PATTERNS = [
  new RegExp(
    `\\b((?:(?:[Tt]ôi|[Mm]ình|[Ee]m)\\s+tên\\s+là|[Mm]y\\s+name\\s+is)\\s+)(${EXPLICIT_NAME_VALUE_TOKEN_SOURCE}(?:\\s+${EXPLICIT_NAME_VALUE_TOKEN_SOURCE}){0,3})(?=\\s+(?:and|va|và|but|nhung|nhưng|${PRIVATE_NAME_PREDICATE_SOURCE})\\b|[,.!?;:]|$)`,
    "giu",
  ),
  new RegExp(
    `\\b(${PRIVATE_RECORD_LABEL_SOURCE}\\s+)(${PRIVATE_NAME_TOKEN_SOURCE}(?:\\s+${PRIVATE_NAME_TOKEN_SOURCE}){0,3})(?=\\s+${PRIVATE_NAME_PREDICATE_SOURCE}\\b|[,.!?;:]|$)`,
    "giu",
  ),
  /\b((?:[Kk]hách hàng|[Hh]ọc viên|[Bb]ệnh nhân|[Cc]lient|[Pp]atient|[Cc]ustomer|[Mm]ember|[Uu]ser)\s+)(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,4})\b/gu,
  /\b((?:[Tt]ôi|[Mm]ình|[Ee]m)\s+tên\s+là\s+)(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,4})\b/gu,
  /\b((?:[Tt]ôi|[Mm]ình|[Ee]m)\s+là\s+)(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){1,4})\b/gu,
];

const PERSONAL_CONTEXT_PATTERN =
  /\b(?:toi|minh|em|cua toi|cua minh|i|me|my|mine|khach hang|hoc vien|benh nhan|nguoi nay|anh ay|co ay|client|patient|customer|member|user|he|him|his|she|her|hers|they|them|their|theirs)\b/i;
const NON_WEIGHT_BODY_METRIC_PATTERN =
  /\b(?:\d+(?:[.,]\d+)?\s*(?:cm|bpm|tuoi|years? old|%\s*mo)|weigh(?:s|ed|ing)?\s+\d+(?:[.,]\d+)?\s*(?:kg|kilograms?|lb|pounds?)|(?:blood pressure|huyet ap)(?:\s+is|\s+la|\s*[:=])?\s*\d{2,3}\s*\/\s*\d{2,3})\b/i;
const KILOGRAM_VALUE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:kg|kilograms?)\b/gi;
const STRONG_BODY_WEIGHT_CUE_PATTERN =
  /\b(?:can nang|trong luong co the|body weight|weigh(?:s|ed|ing)?)\b/i;
const TRAINING_LOAD_CUE_PATTERN =
  /\b(?:tap|workout|training|rpe\d*|rir\d*|sets?|reps?|squat|deadlift|bench(?: press)?|overhead press|barbell|dumbbell|muc ta|ta don|ta tay|lift(?:s|ed|ing)?)\b/i;
const EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN =
  /\b(?:khach hang|hoc vien|benh nhan|client|patient|customer|member|user)\b/i;
const PRIVATE_HEALTH_RECORD_CUE_PATTERN =
  /\b(?:dieu tri|treatment|chemotherapy|chemo|hoa tri|xa tri|dialysis|loc than|metformin|receiv(?:e|es|ed|ing)(?:\s+\w+){0,3}\s+treatment|(?:uong|dung)\s+(?:thuoc|insulin|metformin)|tak(?:e|es|ing)\s+(?:medication|medicine|prescription|insulin|metformin)|medication|medicine|prescription|insulin|bmi|body fat|ty le mo|phan tram mo|hba1c|a1c|cholesterol|ldl|hdl|triglycerides?|duong huyet|blood glucose|blood sugar|nhip tim|heart rate)\b/i;
const LIKELY_PERSON_NAME_GLOBAL_PATTERN =
  /(?<![\p{L}\p{N}_])\p{Lu}[\p{L}\p{M}'’-]*[ \t]+\p{Lu}[\p{L}\p{M}'’-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]*){0,3}(?![\p{L}\p{N}_])/gu;
const LIKELY_SINGLE_CAPITALIZED_TOKEN_GLOBAL_PATTERN =
  /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{M}'’-]*)(?![\p{L}\p{N}_])/gu;
const PRIVATE_SINGLE_NAME_BEFORE_PATTERN =
  /(?:^|\s)(?:cho|cua|voi|ve|gui|hoi|gap|for|with|about|to|suits?|fits?)\s*[([{\"'“‘-]*\s*$/i;
const PRIVATE_SINGLE_NAME_POSSESSIVE_AFTER_PATTERN =
  /^\s+(?:cua\s+(?:toi|minh|em|chung toi|chung minh|khach hang|hoc vien)|nha\s+(?:toi|minh|em)|my|mine)(?=$|[^a-z0-9_])/i;
const PRIVATE_PERSON_RELATION_AFTER_PATTERN =
  /^\s+(?:(?:la|is)\s+)?(?:khach hang|hoc vien|benh nhan|client|patient|customer|member|user)(?:\s+cua\s+(?:toi|minh|em|chung toi|chung minh|my|our))?\b/i;
const PRIVATE_SINGLE_NAME_PREDICATE_AFTER_PATTERN = new RegExp(
  `^\\s+(?:${PRIVATE_NAME_PREDICATE_SOURCE})(?=$|[^\\p{L}\\p{N}_])`,
  "iu",
);
const PRIVATE_SINGLE_NAME_VOCATIVE_AFTER_PATTERN =
  /^\s+(?:ơi|oi)(?=$|[^\p{L}\p{N}_])/iu;
const CAPITALIZED_NAME_COORDINATOR_AFTER_PATTERN =
  /^\s+(?:và|and)\s+\p{Lu}[\p{L}\p{M}'’-]*(?![\p{L}\p{N}_])/u;
const CAPITALIZED_NAME_COORDINATOR_BEFORE_PATTERN =
  /(?<![\p{L}\p{N}_])\p{Lu}[\p{L}\p{M}'’-]*\s+(?:và|and)\s+$/u;
const PRIVATE_PERSON_RELATION_SOURCE =
  "(?:friend|son|daughter|child|kid|father|mother|wife|husband|client|customer|member|patient|ban|con|bo|me|vo|chong|khach hang|hoc vien|benh nhan)";
const PRIVATE_PUBLIC_ALIAS_BEFORE_PATTERN = new RegExp(
  `(?:^|\\s)(?:(?:my|our)\\s+${PRIVATE_PERSON_RELATION_SOURCE}|${PRIVATE_PERSON_RELATION_SOURCE}\\s+(?:toi|minh|em|cua toi|cua minh)|my|cho|for)\\s*[([{\"'“‘-]*\\s*$`,
  "i",
);
const PRIVATE_PUBLIC_ALIAS_AFTER_PATTERN = new RegExp(
  `^\\s+(?:cua\\s+(?:toi|minh|em|chung toi|chung minh|khach hang|hoc vien)|nha\\s+(?:toi|minh|em)|(?:(?:la|is)\\s+)?(?:khach hang|hoc vien|benh nhan|client|patient|customer|member|user)(?:\\s+cua\\s+(?:toi|minh|em|chung toi|chung minh|my|our))?|(?:(?:la|is)\\s+)?(?:(?:my|our)\\s+${PRIVATE_PERSON_RELATION_SOURCE}|${PRIVATE_PERSON_RELATION_SOURCE}\\s+(?:toi|minh|em|cua toi|cua minh))|can|nen|muon|needs?|should|wants?)(?=$|[^a-z0-9_])`,
  "i",
);
const PUBLIC_PERSON_TITLE_BEFORE_NAME_PATTERN =
  /(?:^|[^\p{L}\p{N}_])(?:cầu thủ|vận động viên|vdv|ca sĩ|diễn viên|nhà thơ|nhà văn|tác giả|nhà khoa học|người nổi tiếng|public figure|athlete|footballer|singer|actor|author|scientist)\s+$/iu;
const PUBLIC_PERSON_METADATA_SUFFIX_PATTERN =
  /\s+(?:dob|date of birth|ngày sinh)$/iu;
const SOURCE_NAMED_HEALTH_ASSERTION_PATTERN =
  /^(\p{L}[\p{L}\p{M}'’-]*(?:\s+\p{L}[\p{L}\p{M}'’-]*){0,3}?)\s+(?:has|have|had|bị|mắc|có|(?:(?:was|is|are|were)\s+)?diagnosed(?:\s+with)?|dob|date of birth|ngày sinh)\b/iu;
const GENERIC_SOURCE_SUBJECT_PATTERN =
  /^(?:exercises?|training|strength training|resistance training|physical activity|fitness|workouts?|nutrition|sport|athletes?|patients?|people|guidance|research|studies?|articles?)$/iu;
const PRIVATE_RECORD_URL_PATH_PATTERN =
  /(?:^|\/)(private|cases?|people|persons?|patients?|clients?|customers?|members?|users?|benh[-_]nhan|hoc[-_]vien)\/([^/?#]+)/giu;
const EXPLICIT_PRIVATE_RECORD_URL_CONTAINER_PATTERN =
  /^(?:private|cases?|patients?|clients?|customers?|members?|users?|benh[-_]nhan|hoc[-_]vien)$/iu;
const PRIVATE_RECORD_SLUG_SUFFIX_PATTERN =
  /(?:^|[-_])(?:report|record|profile|chart|case|diagnosis|workout[-_]plan|training[-_]plan)$/iu;
const NUMERIC_CALENDAR_DATE_SOURCE =
  "(?:(?:0?[1-9]|[12]\\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\\d{2}|(?:19|20)\\d{2}[/.-](?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\\d|3[01]))";
const DATE_OF_BIRTH_CUE_SOURCE =
  "(?:date of birth|ngày sinh|ngay sinh|sinh ngày|sinh ngay|dob|born(?:\\s+on)?)";
const NUMERIC_CALENDAR_DATE_GLOBAL_PATTERN = new RegExp(
  `\\b${NUMERIC_CALENDAR_DATE_SOURCE}\\b`,
  "gu",
);
const DATE_OF_BIRTH_CLAUSE_SEPARATOR_PATTERN =
  /(?:[,;\n!?]+|\s+\b(?:and|và)\b\s+)/iu;
const TIME_SENSITIVE_KNOWLEDGE_PATTERN = /\b(?:current|latest)\b/iu;
const PRIVATE_RELATION_RECIPIENT_PATTERN =
  /\b(?:my|our)\s+(?:friend|son|daughter|child|kid|father|mother|wife|husband|client|customer|member|patient)\s+(\p{L}[\p{L}\p{M}'’-]*)/iu;
const LOCATION_ENTITY_BEFORE_PATTERN =
  /(?:^|\s)(?:thoi tiet|du lich|mui gio|dan so|ban do|dia diem|thanh pho|tinh thanh|quoc gia|weather(?: in)?|travel(?: to)?|time zone|timezone|population|map|city|country)\s+$/i;
const LOCATION_ENTITY_AFTER_PATTERN =
  /^\s+(?:thoi tiet|mui gio|dan so|o dau|weather|time zone|timezone|population)\b/i;
const LOCATION_MARKER_BEFORE_ENTITY_PATTERN =
  /(?:^|\s)(?:o|tai|den|from|to|in)\s+$/i;
const LOCATION_QUERY_CONTEXT_PATTERN =
  /\b(?:thoi tiet|du lich|mui gio|dan so|ban do|dia diem|thanh pho|tinh thanh|quoc gia|phong gym|weather|travel|time zone|timezone|population|map|city|country|location|gym)\b/i;
const SPORTS_TEAM_BEFORE_PATTERN =
  /(?:^|\s)(?:lich thi dau|lich dau|tran dau|ket qua tran|ty so|bang xep hang|doi bong|cau lac bo|clb|fixtures?|match schedule|team schedule|standings?|score|lineup|club|team)\s+$/i;
const SPORTS_TEAM_AFTER_PATTERN =
  /^\s+(?:lich thi dau|lich dau|thi dau|dau luc nao|fixtures?|match schedule|team schedule|standings?|score|lineup)\b/i;
const NON_PERSON_ENTITY_TITLE_BEFORE_PATTERN =
  /(?:^|\s)(?:thanh pho|tinh|quoc gia|city|state|country|doi bong|cau lac bo|clb|club|team)\s+$/i;
const NON_PERSON_ORGANIZATION_NAME_PATTERN =
  /\b(?:academy|association|clinic|college|company|council|foundation|group|hospital|institute|journal|laboratory|organisation|organization|school|society|university)\.?$/iu;
const PUBLIC_COMPARISON_BEFORE_NAME_PATTERN =
  /(?:^|\s)(?:giong|nhu|so voi|compared with|like)\s+$/i;
const PUBLIC_ONLY_PERSON_PREDICATE_AFTER_PATTERN =
  /^\s+(?:dang\s+)?(?:luu dien|thi dau)|^\s+(?:dang\s+)?choi cho(?:\s+(?:clb|cau lac bo|doi bong))?\b|^\s+(?:is\s+)?(?:touring|on tour|plays? for|competes? for)\b/i;
const NON_NAME_CAPITALIZED_STARTS = new Set([
  "ai",
  "bai",
  "ban",
  "barbell",
  "bench",
  "boxing",
  "bung",
  "cac",
  "cardio",
  "cach",
  "cau",
  "chan",
  "clb",
  "client",
  "cho",
  "chung",
  "core",
  "creatine",
  "customer",
  "deadlift",
  "dumbbell",
  "em",
  "fitness",
  "he",
  "hiit",
  "hoc",
  "hay",
  "ht",
  "i",
  "gym",
  "knowledge",
  "ke",
  "khach",
  "lich",
  "lunge",
  "lung",
  "member",
  "minh",
  "mong",
  "mot",
  "nguc",
  "nghien",
  "nguon",
  "patient",
  "pilates",
  "plank",
  "press",
  "protein",
  "pullup",
  "pushup",
  "routine",
  "rpe",
  "rir",
  "she",
  "squat",
  "tay",
  "they",
  "thong",
  "tim",
  "toi",
  "user",
  "vai",
  "what",
  "when",
  "whey",
  "workout",
  "yoga",
]);
const VERIFIED_PUBLIC_MONONYM_ALIASES = new Map([
  ["lisa", "Lisa"],
  ["ronaldo", "Ronaldo"],
]);
const VERIFIED_PUBLIC_CANONICAL_IDENTITIES = new Map([
  ["lisa", new Set(["lisa", "lalisa manobal"])],
  ["ronaldo", new Set(["ronaldo", "cristiano ronaldo"])],
]);
const NORMALIZED_PUBLIC_PERSON_TITLE_PREFIX_PATTERN =
  /^(?:(?:cau thu|van dong vien|vdv|ca si|dien vien|nha tho|nha van|tac gia|nha khoa hoc|nguoi noi tieng|public figure|athlete|footballer|singer|actor|author|scientist)\s+)+/i;
const COMMON_VIETNAMESE_GIVEN_NAMES = new Set([
  "an",
  "bao",
  "bảo",
  "binh",
  "bình",
  "duc",
  "đức",
  "dung",
  "dũng",
  "giang",
  "ha",
  "hà",
  "han",
  "hien",
  "hiền",
  "hoa",
  "hoang",
  "hoàng",
  "hung",
  "hùng",
  "huong",
  "hương",
  "khanh",
  "khánh",
  "lan",
  "linh",
  "long",
  "mai",
  "nam",
  "nga",
  "ngoc",
  "ngọc",
  "nhi",
  "phuc",
  "phúc",
  "quan",
  "quân",
  "quynh",
  "quỳnh",
  "son",
  "sơn",
  "thao",
  "thảo",
  "thuy",
  "thủy",
  "tien",
  "tiến",
  "tram",
  "trâm",
  "trang",
  "tuan",
  "tuấn",
  "vy",
  "yen",
  "yến",
]);
const COMMON_VIETNAMESE_SURNAMES = new Set([
  "bui",
  "bùi",
  "dang",
  "đặng",
  "dinh",
  "đinh",
  "do",
  "đỗ",
  "duong",
  "dương",
  "ho",
  "hồ",
  "hoang",
  "hoàng",
  "huynh",
  "huỳnh",
  "le",
  "lê",
  "ly",
  "lý",
  "ngo",
  "ngô",
  "nguyen",
  "nguyễn",
  "pham",
  "phạm",
  "phan",
  "tran",
  "trần",
  "vo",
  "võ",
  "vu",
  "vũ",
]);
const COMMON_ENGLISH_GIVEN_NAMES = new Set([
  "alice",
  "anna",
  "bob",
  "charlie",
  "david",
  "emily",
  "james",
  "jane",
  "jennifer",
  "john",
  "maria",
  "mary",
  "michael",
  "robert",
  "sarah",
]);
const PRIVATE_NAME_CONNECTOR_TOKENS = new Set([
  "about",
  "and",
  "asks",
  "ask",
  "bi",
  "can",
  "cho",
  "co",
  "cua",
  "cung",
  "da",
  "dang",
  "dung",
  "em",
  "for",
  "had",
  "has",
  "hay",
  "hoi",
  "is",
  "la",
  "minh",
  "muon",
  "my",
  "needs",
  "need",
  "nen",
  "our",
  "receives",
  "receiving",
  "takes",
  "take",
  "tap",
  "thuong",
  "to",
  "toi",
  "trains",
  "train",
  "uong",
  "uses",
  "use",
  "va",
  "ve",
  "voi",
  "vua",
  "wants",
  "want",
  "was",
  "with",
]);
const CLEAR_NON_PERSON_IDENTITY_STARTS = new Set([
  "all",
  "athlete",
  "athletes",
  "beginner",
  "beginners",
  "children",
  "clients",
  "everyone",
  "explosive",
  "fat",
  "football",
  "home",
  "her",
  "him",
  "kids",
  "lower",
  "me",
  "muscle",
  "myself",
  "newcomer",
  "newcomers",
  "nguoi",
  "office",
  "people",
  "person",
  "posterior",
  "push",
  "recovery",
  "runner",
  "runners",
  "seniors",
  "someone",
  "students",
  "strength",
  "suc",
  "tang",
  "giam",
  "dan",
  "them",
  "trainees",
  "us",
  "women",
  "you",
  "yourself",
]);
const CLEAR_NON_PERSON_IDENTITY_PHRASE_PATTERN =
  /^(?:(?:my|our)\s+(?:client|customer|member|patient|friend|father|mother|wife|husband|child|kid)|(?:fat|weight)\s+loss|muscle\s+gain|push\s+pull\s+legs|lower\s+back|posterior\s+chain|explosive\s+power|(?:tang|giam)\s+(?:co|mo|can)|suc\s+(?:manh|ben)|dan\s+chay\s+bo|nam|nu|ppl|hiit|rpe|rir)$/i;
const PRIVATE_NAME_WORD_PATTERN = /\p{L}[\p{L}\p{M}'’-]*/gu;
const PRIVATE_NAME_PREDICATE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])${PRIVATE_NAME_PREDICATE_SOURCE}(?![\\p{L}\\p{N}_])`,
  "giu",
);
const PRIVATE_SUBJECT_CUE_PATTERNS = [
  new RegExp(
    `(?:^|[\\n.!?]\\s*)(\\p{L}[\\p{L}\\p{M}'’-]*(?:[ \\t]+\\p{L}[\\p{L}\\p{M}'’-]*){0,3}?)(?=\\s+(?:của|cua)\\s+(?:tôi|toi|mình|minh|em|chúng tôi|chung toi|chúng mình|chung minh|my|our)\\b)`,
    "gimu",
  ),
  new RegExp(
    `(?:^|[\\n.!?]\\s*)(\\p{L}[\\p{L}\\p{M}'’-]*(?:[ \\t]+\\p{L}[\\p{L}\\p{M}'’-]*){0,3}?)(?=\\s+(?:(?:là|la|is)\\s+)?(?:khách hàng|khach hang|học viên|hoc vien|bệnh nhân|benh nhan|client|patient|customer|member|user)\\b)`,
    "gimu",
  ),
];
const PRIVATE_RECIPIENT_NAME_PATTERN =
  /(?:^|[^\p{L}\p{N}_])(?:cho|for|to)\s+([\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+){0,3}?)(?=\s+(?:and|và)\b|\s+\d+(?:[.,]\d+)?\s*(?:cm|kg|kilograms?|lb|pounds?)\b|[,.!?;:]|$)/gimu;
const PRIVATE_BEHAVIOR_SUBJECT_PATTERN =
  /(?:^|[\n.!?]\s*)(?:cầu thủ|vận động viên|vdv|ca sĩ|diễn viên|public figure|athlete|footballer|singer|actor)?\s*(\p{L}[\p{L}\p{M}'’-]*(?:[ \t]+\p{L}[\p{L}\p{M}'’-]*){0,3}?)(?=\s+(?:(?:thường|thuong|hay|đang|dang|vừa|vua|đã|da)\s+(?:tập|tap|uống|uong|dùng|dung|hỏi|hoi|muốn|muon|cần|can|bị|bi|có|co)|(?:trains?|takes?|uses?|asks?|wants?|needs?)\b|(?:(?:hiện|hien)\s+)?bao\s+nhiêu\s+tuổi\b|(?:chơi|choi)\s+cho\b|(?:(?:đang|dang)\s+)?(?:lưu\s+diễn|luu\s+dien)\b|(?:sống\s+ở\s+đâu|song\s+o\s+dau)\b))/gimu;
const PRIVATE_POSSESSOR_NAME_PATTERN =
  /\b(?:bài tập|bai tap|lịch tập|lich tap|workout|routine|training plan)\s+(?:của|cua|for)\s+(\p{L}[\p{L}\p{M}'’-]*(?:\s+\p{L}[\p{L}\p{M}'’-]*){0,3})(?=$|[,.!?;:]|\s+(?:who|mà|ma)\b)/gimu;
const PRIVATE_SELF_IDENTIFICATION_PATTERN = new RegExp(
  `\\b(?:tôi|toi|mình|minh|em|i)\\s+(?:là|la|am)\\s+(${EXPLICIT_NAME_VALUE_TOKEN_SOURCE}(?:\\s+${EXPLICIT_NAME_VALUE_TOKEN_SOURCE}){0,3})(?=\\s*[,.;:!?]|\\s+(?:and|và|va|but|nhưng|nhung|${PRIVATE_NAME_PREDICATE_SOURCE})\\b|$)`,
  "gimu",
);
const PRIVATE_LABELED_NAME_PATTERN =
  /\b(?:client|patient|customer|member|user|khách hàng|khach hang|học viên|hoc vien|bệnh nhân|benh nhan)\s+(?!(?:should|do(?:es)?|follow|use)(?=\s*(?:[,.!?;:]|$)))(\p{L}[\p{L}\p{M}'’-]*(?:\s+\p{L}[\p{L}\p{M}'’-]*){0,3}?)(?=\s+(?:should|needs?|wants?|asks?|is|was|has|had|hỏi|hoi|bị|bi|có|co|cần|can|muốn|muon|tập|tap)\b|[,.!?;:]|$)/gimu;
const PRIVATE_NAME_RELATION_SUFFIX_PATTERN =
  /(?:^|[\n.!?]\s*)(\p{L}[\p{L}\p{M}'’-]*(?:\s+\p{L}[\p{L}\p{M}'’-]*){0,3}?)(?=\s+(?:is|là|la)\s+(?:my|our|của tôi|cua toi|của mình|cua minh)\s+(?:client|patient|customer|member|user|khách hàng|khach hang|học viên|hoc vien|bệnh nhân|benh nhan)\b)/gimu;
const ENGLISH_PRIVATE_FITNESS_SUBJECT_PATTERN =
  /\b(?:what\s+(?:exercise|workout)|which\s+(?:exercise|workout)|workout advice|exercise advice|training plan)\s+(?:should\s+|for\s+)?(\p{L}[\p{L}\p{M}'’-]*(?:\s+\p{L}[\p{L}\p{M}'’-]*){0,3}?)(?=\s+(?:do|follow|use|who|with|has|is)\b|[,.!?;:]|$)/gimu;
const STANDALONE_PRIVATE_NAME_PATTERN =
  /^[ \t]*(\p{L}[\p{L}\p{M}'’-]*(?:[ \t]+\p{L}[\p{L}\p{M}'’-]*){0,3})[ \t]*(?:[.!?…]+)?[ \t]*$/gmu;

const boundedText = (value, maximum) => String(value || "").trim().slice(0, maximum);

const normalizePrivacyText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const normalizeNameLexeme = (value) =>
  String(value || "").normalize("NFKC").toLocaleLowerCase("vi");

const containsPersonalBodyMetric = (value) => {
  const normalized = normalizePrivacyText(value);
  if (NON_WEIGHT_BODY_METRIC_PATTERN.test(normalized)) return true;

  for (const match of normalized.matchAll(KILOGRAM_VALUE_PATTERN)) {
    if (match.index === undefined) continue;
    const prefix = normalized.slice(Math.max(0, match.index - 80), match.index);
    if (STRONG_BODY_WEIGHT_CUE_PATTERN.test(prefix)) return true;
    const nearbyPrefix = prefix.slice(-48);
    if (
      PERSONAL_CONTEXT_PATTERN.test(prefix) &&
      !TRAINING_LOAD_CUE_PATTERN.test(nearbyPrefix)
    ) {
      return true;
    }
  }
  return false;
};

const hasClearNonPersonEntityContext = ({ text, index, name }) => {
  const normalizedPrefix = normalizePrivacyText(text.slice(0, index));
  const normalizedSuffix = normalizePrivacyText(
    text.slice(index + String(name || "").length),
  );
  return (
    LOCATION_ENTITY_BEFORE_PATTERN.test(normalizedPrefix) ||
    LOCATION_ENTITY_AFTER_PATTERN.test(normalizedSuffix) ||
    (LOCATION_MARKER_BEFORE_ENTITY_PATTERN.test(normalizedPrefix) &&
      LOCATION_QUERY_CONTEXT_PATTERN.test(normalizedPrefix)) ||
    NON_PERSON_ENTITY_TITLE_BEFORE_PATTERN.test(normalizedPrefix) ||
    SPORTS_TEAM_BEFORE_PATTERN.test(normalizedPrefix) ||
    SPORTS_TEAM_AFTER_PATTERN.test(normalizedSuffix)
  );
};

const extractContextualPublicNames = (value) => {
  const text = String(value || "");
  const names = new Set();
  for (const match of text.matchAll(LIKELY_PERSON_NAME_GLOBAL_PATTERN)) {
    if (!match[0] || match.index === undefined) continue;
    const prefix = text.slice(Math.max(0, match.index - 48), match.index);
    const suffix = text.slice(match.index + match[0].length);
    if (
      PUBLIC_PERSON_TITLE_BEFORE_NAME_PATTERN.test(prefix) ||
      PUBLIC_COMPARISON_BEFORE_NAME_PATTERN.test(normalizePrivacyText(prefix)) ||
      (PUBLIC_ONLY_PERSON_PREDICATE_AFTER_PATTERN.test(
        normalizePrivacyText(suffix),
      ) &&
        !hasPrivatePublicAliasContext({
          text,
          index: match.index,
          name: match[0],
        }))
    ) {
      const name = match[0]
        .replace(PUBLIC_PERSON_METADATA_SUFFIX_PATTERN, "")
        .trim();
      if (name) names.add(name);
    }
  }
  return [...names];
};

const hasPrivatePublicAliasContext = ({ text, index, name }) => {
  const prefix = text.slice(0, index);
  const suffix = text.slice(index + name.length);
  const hasPrivateBoundary = (candidatePrefix, candidateSuffix) =>
    PRIVATE_PUBLIC_ALIAS_BEFORE_PATTERN.test(
      normalizePrivacyText(candidatePrefix),
    ) ||
    PRIVATE_PUBLIC_ALIAS_AFTER_PATTERN.test(
      normalizePrivacyText(candidateSuffix),
    );
  if (hasPrivateBoundary(prefix, suffix)) return true;

  const aliasEnd = index + name.length;
  for (const fullNameMatch of text.matchAll(LIKELY_PERSON_NAME_GLOBAL_PATTERN)) {
    if (fullNameMatch.index === undefined) continue;
    const fullNameStart = fullNameMatch.index;
    const fullNameEnd = fullNameStart + fullNameMatch[0].length;
    if (index < fullNameStart || aliasEnd > fullNameEnd) continue;
    if (
      hasPrivateBoundary(
        text.slice(0, fullNameStart),
        text.slice(fullNameEnd),
      )
    ) {
      return true;
    }
  }
  return false;
};

const extractVerifiedPublicMononyms = (value) => {
  const text = String(value || "");
  const names = new Set();
  for (const match of text.matchAll(
    /(?<![\p{L}\p{N}_])(\p{L}[\p{L}\p{M}'’-]*)(?![\p{L}\p{N}_])/gu,
  )) {
    const canonicalName = VERIFIED_PUBLIC_MONONYM_ALIASES.get(
      normalizePrivacyText(match[1]),
    );
    if (
      canonicalName &&
      match.index !== undefined &&
      !hasPrivatePublicAliasContext({
        text,
        index: match.index,
        name: match[1],
      })
    ) {
      names.add(canonicalName);
    }
  }
  return [...names];
};

const extractVerifiedPublicFullNames = (value) => {
  const text = String(value || "");
  const names = new Set();
  for (const match of text.matchAll(LIKELY_PERSON_NAME_GLOBAL_PATTERN)) {
    if (!match[0] || match.index === undefined) continue;
    const name = match[0]
      .replace(PUBLIC_PERSON_METADATA_SUFFIX_PATTERN, "")
      .trim();
    const tokens = normalizePrivacyText(name).split(/\s+/).filter(Boolean);
    if (
      tokens.length < 2 ||
      !tokens.some((token) => VERIFIED_PUBLIC_MONONYM_ALIASES.has(token)) ||
      hasPrivatePublicAliasContext({ text, index: match.index, name })
    ) {
      continue;
    }
    names.add(name);
  }
  return [...names];
};

const hasPrivateSingleNameContext = ({ text, index, name }) => {
  const prefix = text.slice(0, index);
  const suffix = text.slice(index + name.length);
  return (
    PRIVATE_SINGLE_NAME_BEFORE_PATTERN.test(normalizePrivacyText(prefix)) ||
    PRIVATE_SINGLE_NAME_POSSESSIVE_AFTER_PATTERN.test(
      normalizePrivacyText(suffix),
    ) ||
    PRIVATE_PERSON_RELATION_AFTER_PATTERN.test(normalizePrivacyText(suffix)) ||
    PRIVATE_SINGLE_NAME_PREDICATE_AFTER_PATTERN.test(suffix) ||
    PRIVATE_SINGLE_NAME_VOCATIVE_AFTER_PATTERN.test(suffix) ||
    CAPITALIZED_NAME_COORDINATOR_AFTER_PATTERN.test(suffix) ||
    CAPITALIZED_NAME_COORDINATOR_BEFORE_PATTERN.test(prefix)
  );
};

const isLikelyPrivateNameCandidate = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  const normalized = normalizePrivacyText(candidate).trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const nameLexemeTokens = normalizeNameLexeme(candidate).trim().split(/\s+/);
  if (!tokens.length || NON_NAME_CAPITALIZED_STARTS.has(tokens[0])) return false;
  if (VERIFIED_PUBLIC_MONONYM_ALIASES.has(normalized)) return true;
  if (COMMON_VIETNAMESE_SURNAMES.has(nameLexemeTokens[0])) return true;
  if (
    tokens.length === 1 &&
    (COMMON_VIETNAMESE_GIVEN_NAMES.has(nameLexemeTokens[0]) ||
      COMMON_ENGLISH_GIVEN_NAMES.has(nameLexemeTokens[0]))
  ) {
    return true;
  }
  return candidate
    .split(/\s+/)
    .every((token) => /^\p{Lu}[\p{L}\p{M}'’-]*$/u.test(token));
};

const isSyntacticallyBoundPrivateNameCandidate = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  const normalizedCandidate = normalizePrivacyText(candidate).trim();
  if (
    CLEAR_NON_PERSON_IDENTITY_PHRASE_PATTERN.test(normalizedCandidate) &&
    !(
      /^(?:Nam|Nu|Nữ)$/u.test(candidate) &&
      candidate !== candidate.toLocaleLowerCase("vi")
    )
  ) {
    return false;
  }
  if (isLikelyPrivateNameCandidate(candidate)) return true;

  const tokens = normalizedCandidate.split(/\s+/).filter(Boolean);
  if (
    tokens.length === 0 ||
    tokens.length > 4 ||
    NON_NAME_CAPITALIZED_STARTS.has(tokens[0]) ||
    CLEAR_NON_PERSON_IDENTITY_STARTS.has(tokens[0])
  ) {
    return false;
  }
  return /^[\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+){0,3}$/u.test(
    candidate,
  );
};

const trimPrivateNameConnectors = (value) => {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  while (
    tokens.length > 0 &&
    PRIVATE_NAME_CONNECTOR_TOKENS.has(normalizePrivacyText(tokens.at(-1)))
  ) {
    tokens.pop();
  }
  return tokens.join(" ");
};

const isVietnameseLexiconNameCandidate = (value) => {
  const tokens = normalizeNameLexeme(value).trim().split(/\s+/).filter(Boolean);
  return (
    COMMON_VIETNAMESE_SURNAMES.has(tokens[0]) ||
    (tokens.length === 1 && COMMON_VIETNAMESE_GIVEN_NAMES.has(tokens[0]))
  );
};

const extractPredicateBoundVietnameseNames = (value) => {
  const text = String(value || "");
  const names = new Set();
  for (const predicate of text.matchAll(PRIVATE_NAME_PREDICATE_PATTERN)) {
    if (predicate.index === undefined) continue;
    const prefix = text.slice(0, predicate.index);
    const trimmedEnd = prefix.trimEnd().length;
    if (!trimmedEnd || trimmedEnd !== prefix.length) {
      const words = [...prefix.slice(0, trimmedEnd).matchAll(PRIVATE_NAME_WORD_PATTERN)];
      const lastWord = words.at(-1);
      if (
        !lastWord ||
        lastWord.index === undefined ||
        lastWord.index + lastWord[0].length !== trimmedEnd
      ) {
        continue;
      }

      const recentWords = words.slice(-4);
      const surnameIndex = recentWords.findIndex((word) =>
        COMMON_VIETNAMESE_SURNAMES.has(normalizeNameLexeme(word[0])),
      );
      let addedSurnameCandidate = false;
      if (surnameIndex >= 0) {
        const firstNameWord = recentWords[surnameIndex];
        const candidate = text.slice(firstNameWord.index, trimmedEnd);
        const candidateTokens = normalizePrivacyText(candidate).split(/\s+/);
        if (
          /^[\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+){0,3}$/u.test(candidate) &&
          candidateTokens.slice(1).every(
            (token) => !PRIVATE_NAME_CONNECTOR_TOKENS.has(token),
          )
        ) {
          names.add(candidate);
          addedSurnameCandidate = true;
        }
      }
      if (
        !addedSurnameCandidate &&
        COMMON_VIETNAMESE_GIVEN_NAMES.has(normalizeNameLexeme(lastWord[0]))
      ) {
        names.add(lastWord[0]);
      }
    }
  }
  return [...names];
};

const extractStrongPrivateCueNames = (value) => {
  const text = String(value || "");
  const names = new Set(extractPredicateBoundVietnameseNames(text));
  for (const match of text.matchAll(STANDALONE_PRIVATE_NAME_PATTERN)) {
    if (match[1] && isVietnameseLexiconNameCandidate(match[1])) {
      names.add(match[1]);
    }
  }
  for (const pattern of PRIVATE_SUBJECT_CUE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[1] && isLikelyPrivateNameCandidate(match[1])) {
        names.add(match[1]);
      }
    }
  }
  for (const match of text.matchAll(PRIVATE_BEHAVIOR_SUBJECT_PATTERN)) {
    const candidate = trimPrivateNameConnectors(match[1]);
    if (
      candidate &&
      isSyntacticallyBoundPrivateNameCandidate(candidate)
    ) {
      names.add(candidate);
    }
  }
  for (const pattern of [
    PRIVATE_POSSESSOR_NAME_PATTERN,
    PRIVATE_SELF_IDENTIFICATION_PATTERN,
    PRIVATE_LABELED_NAME_PATTERN,
    PRIVATE_NAME_RELATION_SUFFIX_PATTERN,
    ENGLISH_PRIVATE_FITNESS_SUBJECT_PATTERN,
  ]) {
    for (const match of text.matchAll(pattern)) {
      const candidate = trimPrivateNameConnectors(match[1]);
      if (
        candidate &&
        isSyntacticallyBoundPrivateNameCandidate(candidate)
      ) {
        names.add(candidate);
      }
    }
  }
  for (const match of text.matchAll(PRIVATE_RECIPIENT_NAME_PATTERN)) {
    const relationName = match[1]?.match(PRIVATE_RELATION_RECIPIENT_PATTERN)?.[1];
    const candidate = trimPrivateNameConnectors(relationName || match[1]);
    if (
      candidate &&
      match.index !== undefined &&
      isSyntacticallyBoundPrivateNameCandidate(candidate) &&
      !hasClearNonPersonEntityContext({
        text,
        index: match.index + match[0].indexOf(candidate),
        name: candidate,
      })
    ) {
      names.add(candidate);
    }
  }
  return [...names];
};

const extractUnboundPrivateNames = (value, allowedPublicPersonNames = []) => {
  const text = String(value || "");
  const names = new Set();
  const multiTokenNameRanges = [];
  const publicDateOfBirthLookup = containsPublicDateOfBirthBinding(
    text,
    allowedPublicPersonNames,
  );
  const allowedNames = new Set(
    (Array.isArray(allowedPublicPersonNames) ? allowedPublicPersonNames : [])
      .map((name) => normalizePrivacyText(name).trim())
      .filter(Boolean),
  );
  for (const name of extractStrongPrivateCueNames(text)) {
    const normalizedName = normalizePrivacyText(name).trim();
    if (allowedNames.has(normalizedName)) continue;
    names.add(name);
  }
  for (const match of text.matchAll(
    /(?<![\p{L}\p{N}_])(\p{L}[\p{L}\p{M}'’-]*)(?![\p{L}\p{N}_])/gu,
  )) {
    const normalizedName = normalizePrivacyText(match[1]);
    const belongsToAllowedPublicName = (
      Array.isArray(allowedPublicPersonNames) ? allowedPublicPersonNames : []
    ).some(
      (allowedName) =>
        normalizePrivacyText(allowedName)
          .trim()
          .split(/\s+/)
          .includes(normalizedName) &&
        containsExactAllowedPublicPersonName(text, [allowedName]),
    );
    if (
      VERIFIED_PUBLIC_MONONYM_ALIASES.has(normalizedName) &&
      ((!allowedNames.has(normalizedName) && !belongsToAllowedPublicName) ||
        hasPrivatePublicAliasContext({
          text,
          index: match.index,
          name: match[1],
        }))
    ) {
      names.add(match[1]);
    }
  }
  for (const match of text.matchAll(LIKELY_PERSON_NAME_GLOBAL_PATTERN)) {
    const name = match[0]
      .replace(PUBLIC_PERSON_METADATA_SUFFIX_PATTERN, "")
      .trim();
    if (!name || match.index === undefined) continue;
    const normalizedName = normalizePrivacyText(name).trim();
    const firstToken = normalizedName.split(/\s+/)[0];
    if (NON_NAME_CAPITALIZED_STARTS.has(firstToken)) continue;

    multiTokenNameRanges.push({
      start: match.index,
      end: match.index + name.length,
    });
    if (
      allowedNames.has(normalizedName) ||
      NON_PERSON_ORGANIZATION_NAME_PATTERN.test(name) ||
      hasClearNonPersonEntityContext({
        text,
        index: match.index,
        name,
      })
    ) {
      continue;
    }
    names.add(name);
  }
  for (const match of text.matchAll(
    LIKELY_SINGLE_CAPITALIZED_TOKEN_GLOBAL_PATTERN,
  )) {
    const name = match[1];
    if (!name || match.index === undefined) continue;
    const matchEnd = match.index + match[0].length;
    if (
      multiTokenNameRanges.some(
        (range) => match.index >= range.start && matchEnd <= range.end,
      )
    ) {
      continue;
    }
    const normalizedName = normalizePrivacyText(name).trim();
    const isAcronym = name.length > 1 && name === name.toLocaleUpperCase();
    if (
      allowedNames.has(normalizedName) ||
      NON_NAME_CAPITALIZED_STARTS.has(normalizedName) ||
      isAcronym ||
      hasClearNonPersonEntityContext({
        text,
        index: match.index,
        name,
      }) ||
      (!hasPrivateSingleNameContext({ text, index: match.index, name }) &&
        !(publicDateOfBirthLookup && isLikelyPrivateNameCandidate(name)))
    ) {
      continue;
    }
    names.add(name);
  }
  return [...names];
};

export function getPublicPersonLookupNames(value) {
  const text = String(value || "");
  const normalized = normalizePrivacyText(text);
  if (EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(normalized)) return [];

  // Chỉ bind tên có tín hiệu public ngay trong request (vai trò công chúng
  // hoặc phép so sánh rõ ràng). Một tên viết hoa đơn độc không chứng minh đó
  // là người nổi tiếng và phải tiếp tục đi qua nhánh ambiguous/fail-closed.
  const contextualNames = [
    ...new Set([
      ...extractContextualPublicNames(text),
      ...extractVerifiedPublicFullNames(text),
    ]),
  ];
  const verifiedMononyms = extractVerifiedPublicMononyms(text).filter(
    (alias) => {
      const normalizedAlias = normalizePrivacyText(alias).trim();
      return !contextualNames.some((name) => {
        const normalizedTokens = normalizePrivacyText(name)
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return normalizedTokens.length > 1 && normalizedTokens.includes(normalizedAlias);
      });
    },
  );
  return [
    ...new Set([
      ...contextualNames,
      ...verifiedMononyms,
    ]),
  ];
}

export const hashKnowledgeText = (value) =>
  crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");

export function buildConversationKnowledgeSource({
  conversationId,
  question,
  answer,
  questionIndex,
  answerIndex,
  capturedAt = new Date(),
}) {
  return {
    conversationId,
    messageIndex: questionIndex,
    questionIndex,
    answerIndex,
    questionMessageId: question?._id || null,
    answerMessageId: answer?._id || null,
    questionHash: hashKnowledgeText(question?.content),
    answerHash: hashKnowledgeText(answer?.content),
    capturedAt,
  };
}

function containsExactAllowedPublicPersonName(
  value,
  allowedPublicPersonNames,
) {
  return (
    Array.isArray(allowedPublicPersonNames) ? allowedPublicPersonNames : []
  ).some(
    (candidate) => {
      const name = String(candidate || "").normalize("NFKC").trim();
      if (!name || name.length > 100) return false;
      return new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`,
        "iu",
      ).test(String(value || ""));
    },
  );
}

function containsPublicDateOfBirthBinding(value, allowedPublicPersonNames) {
  const text = String(value || "");
  return (
    Array.isArray(allowedPublicPersonNames) ? allowedPublicPersonNames : []
  ).some((candidate) => {
    const name = String(candidate || "").normalize("NFKC").trim();
    if (!name || name.length > 100) return false;
    const exactName = `(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`;
    return new RegExp(
      `(?:${exactName}[^\\n.!?;]{0,48}\\b${DATE_OF_BIRTH_CUE_SOURCE}\\b|\\b${DATE_OF_BIRTH_CUE_SOURCE}\\b[^\\n.!?;]{0,48}${exactName})`,
      "iu",
    ).test(text);
  });
}

export function isCallerVettedPublicDateOfBirth(
  question,
  allowedPublicPersonNames = [],
) {
  const normalizedQuestion = normalizePrivacyText(question);
  const hasPublicDateOfBirthBinding = containsPublicDateOfBirthBinding(
    question,
    allowedPublicPersonNames,
  );
  if (
    (!containsDateOfBirthInformation(question) &&
      !hasPublicDateOfBirthBinding) ||
    containsHealthInformation(question) ||
    containsPersonalBodyMetric(question) ||
    PERSONAL_CONTEXT_PATTERN.test(normalizedQuestion) ||
    EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(normalizedQuestion)
  ) {
    return false;
  }

  const dateOfBirthClauses = String(question || "")
    .split(DATE_OF_BIRTH_CLAUSE_SEPARATOR_PATTERN)
    .map((clause) => clause.trim())
    .filter(
      (clause) =>
        containsDateOfBirthInformation(clause) ||
        containsPublicDateOfBirthBinding(clause, allowedPublicPersonNames),
    );
  if (dateOfBirthClauses.length === 0) return false;

  return dateOfBirthClauses.every((clause) => {
    const dates = [...clause.matchAll(NUMERIC_CALENDAR_DATE_GLOBAL_PATTERN)];
    return (
      dates.length <= 1 &&
      containsPublicDateOfBirthBinding(clause, allowedPublicPersonNames)
    );
  });
}

const containsTimeSensitivePrivatePersonRequest = (
  value,
  allowedPublicPersonNames = [],
) => {
  const text = String(value || "");
  if (!TIME_SENSITIVE_KNOWLEDGE_PATTERN.test(text)) return false;
  if (extractUnboundPrivateNames(text, allowedPublicPersonNames).length > 0) {
    return true;
  }

  const allowedNames = new Set(
    (Array.isArray(allowedPublicPersonNames) ? allowedPublicPersonNames : [])
      .map((name) => normalizeNameLexeme(name).trim())
      .filter(Boolean),
  );
  for (const match of text.matchAll(PRIVATE_RECIPIENT_NAME_PATTERN)) {
    const candidate = String(match[1] || "").trim();
    if (!candidate || allowedNames.has(normalizeNameLexeme(candidate))) continue;
    const candidateTokens = normalizeNameLexeme(candidate)
      .split(/\s+/)
      .filter(Boolean);
    const lastToken = candidateTokens.at(-1);
    if (
      PRIVATE_RELATION_RECIPIENT_PATTERN.test(candidate) ||
      isLikelyPrivateNameCandidate(candidate) ||
      COMMON_VIETNAMESE_GIVEN_NAMES.has(lastToken) ||
      COMMON_ENGLISH_GIVEN_NAMES.has(lastToken)
    ) {
      return true;
    }
  }
  return false;
};

const containsSensitivePersonalHealth = (
  question,
  answer,
  allowedPublicPersonNames = [],
  { allowCallerVettedPublicDateOfBirth = false } = {},
) => {
  const combined = `${question}\n${answer}`.normalize("NFKC");
  const publicDateOfBirthAllowed =
    allowCallerVettedPublicDateOfBirth &&
    !String(answer || "").trim() &&
    isCallerVettedPublicDateOfBirth(question, allowedPublicPersonNames);
  const personalHealthClauses = splitHealthClauses(combined).filter(
    containsPersonalHealthData,
  );
  const namedHealthSubjects = extractNamedPersonalHealthSubjects(combined);
  const allNamedHealthSubjectsBound = namedHealthSubjects.every((subject) => {
    const normalizedSubject = normalizePrivacyText(subject)
      .trim()
      .replace(NORMALIZED_PUBLIC_PERSON_TITLE_PREFIX_PATTERN, "")
      .trim();
    return (Array.isArray(allowedPublicPersonNames)
      ? allowedPublicPersonNames
      : []).some((name) => {
      const normalizedName = normalizePrivacyText(name).trim();
      if (!normalizedName) return false;
      const verifiedIdentities =
        VERIFIED_PUBLIC_CANONICAL_IDENTITIES.get(normalizedName) ||
        new Set([normalizedName]);
      return verifiedIdentities.has(normalizedSubject);
    });
  });
  const callerVettedPublicPersonOnly =
    Array.isArray(allowedPublicPersonNames) &&
    allowedPublicPersonNames.length > 0 &&
    personalHealthClauses.length > 0 &&
    allNamedHealthSubjectsBound &&
    personalHealthClauses.every(
      (clause) =>
        containsExactAllowedPublicPersonName(
          clause,
          allowedPublicPersonNames,
        ) &&
        !PERSONAL_CONTEXT_PATTERN.test(normalizePrivacyText(clause)) &&
        !EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(
          normalizePrivacyText(clause),
        ),
    ) &&
    !containsDateOfBirthInformation(combined) &&
    containsExactAllowedPublicPersonName(combined, allowedPublicPersonNames) &&
    !PERSONAL_CONTEXT_PATTERN.test(normalizePrivacyText(combined)) &&
    !EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(
      normalizePrivacyText(combined),
    ) &&
    extractUnboundPrivateNames(combined, allowedPublicPersonNames).length === 0;
  if (
    containsPersonalHealthData(combined) &&
    !publicDateOfBirthAllowed &&
    !callerVettedPublicPersonOnly
  ) {
    return true;
  }

  const normalized = normalizePrivacyText(combined);
  const containsHealth = containsHealthInformation(combined);
  const containsMetric = containsPersonalBodyMetric(combined);
  const containsExplicitPrivateHealthRecord =
    EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(normalized) &&
    (containsHealth ||
      containsMetric ||
      PRIVATE_HEALTH_RECORD_CUE_PATTERN.test(normalized));
  if (containsExplicitPrivateHealthRecord) return true;
  if (!containsHealth && !containsMetric) return false;

  const likelyNamedPerson =
    extractUnboundPrivateNames(combined, allowedPublicPersonNames).length > 0;
  if (containsHealth && likelyNamedPerson) return true;
  return (
    containsMetric &&
    (PERSONAL_CONTEXT_PATTERN.test(normalized) ||
      likelyNamedPerson ||
      /\bweigh(?:s|ed|ing)?\s+\d/i.test(normalized))
  );
};

export function isCallerVettedPublicPersonClaim(
  question,
  allowedPublicPersonNames = [],
) {
  return (
    Array.isArray(allowedPublicPersonNames) &&
    allowedPublicPersonNames.length > 0 &&
    containsExactAllowedPublicPersonName(question, allowedPublicPersonNames) &&
    !containsSensitivePersonalHealth(question, "", allowedPublicPersonNames, {
      allowCallerVettedPublicDateOfBirth: true,
    })
  );
}

const extractContextualPrivateNames = (value) => {
  const names = new Set();
  for (const pattern of CONTEXTUAL_PRIVATE_NAME_PATTERNS) {
    for (const match of String(value || "").matchAll(pattern)) {
      if (match[2]) names.add(match[2]);
    }
  }
  return [...names];
};

const maskCallerVettedPublicNames = (value, allowedPublicPersonNames) => {
  let masked = String(value || "");
  for (const candidate of Array.isArray(allowedPublicPersonNames)
    ? allowedPublicPersonNames
    : []) {
    const name = String(candidate || "").normalize("NFKC").trim();
    if (!name || name.length > 100) continue;
    masked = masked.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`,
        "giu",
      ),
      "public_person",
    );
  }
  return masked;
};

const isStrongSourcePrivateName = (value, sourceText) => {
  const name = String(value || "").trim();
  if (!name) return false;
  const tokens = normalizeNameLexeme(name).split(/\s+/).filter(Boolean);
  if (
    COMMON_VIETNAMESE_SURNAMES.has(tokens[0]) ||
    COMMON_VIETNAMESE_GIVEN_NAMES.has(tokens[0]) ||
    COMMON_ENGLISH_GIVEN_NAMES.has(tokens[0]) ||
    tokens.some((token) => VERIFIED_PUBLIC_MONONYM_ALIASES.has(token))
  ) {
    return true;
  }

  const index = String(sourceText || "").indexOf(name);
  if (index < 0) return false;
  const suffix = String(sourceText || "").slice(index + name.length);
  return (
    PRIVATE_SINGLE_NAME_PREDICATE_AFTER_PATTERN.test(suffix) ||
    PRIVATE_PERSON_RELATION_AFTER_PATTERN.test(normalizePrivacyText(suffix))
  );
};

const extractSourceMetadataPrivateNames = (
  fields,
  allowedPublicPersonNames = [],
) => {
  const names = new Set();
  for (const field of fields) {
    const masked = maskCallerVettedPublicNames(field, allowedPublicPersonNames);
    for (const name of extractContextualPrivateNames(masked)) names.add(name);
    for (const name of extractUnboundPrivateNames(masked)) {
      if (isStrongSourcePrivateName(name, masked)) names.add(name);
    }
    if (containsPersonalHealthData(masked)) {
      const namedAssertion = masked.match(SOURCE_NAMED_HEALTH_ASSERTION_PATTERN);
      const candidate = namedAssertion?.[1];
      if (
        candidate &&
        !GENERIC_SOURCE_SUBJECT_PATTERN.test(candidate) &&
        isSyntacticallyBoundPrivateNameCandidate(candidate)
      ) {
        names.add(candidate);
      }
    }
  }
  return [...names];
};

const decodePrivacyCandidates = (value) => {
  const candidates = [String(value || "")];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(candidates.at(-1).replaceAll("+", "%20"));
      if (decoded === candidates.at(-1)) break;
      candidates.push(decoded);
    } catch {
      break;
    }
  }
  return candidates;
};

const hasCredentialUrlParameter = (value) =>
  [...String(value || "").matchAll(URL_PATTERN)].some(([rawUrl]) => {
    try {
      const url = new URL(rawUrl);
      return hasKnowledgeSourceCredentialParameters(url);
    } catch {
      return false;
    }
  });

const sourceUrlPrivateRecordRisk = (value, allowedPublicPersonNames) => {
  let ambiguousIdentity = false;
  for (const candidate of decodePrivacyCandidates(value)) {
    let path;
    try {
      path = new URL(candidate).pathname;
    } catch {
      continue;
    }
    const pathSegments = path.split("/").filter(Boolean);
    if (
      pathSegments.some((segment) =>
        EXPLICIT_PRIVATE_RECORD_URL_CONTAINER_PATTERN.test(segment),
      )
    ) {
      if (containsHealthInformation(pathSegments.join(" "))) {
        return "sensitive_personal_health";
      }
      ambiguousIdentity = true;
      continue;
    }
    const privateRecordSegments = [...path.matchAll(PRIVATE_RECORD_URL_PATH_PATTERN)]
      .map((match) => ({
        slug: match[2],
        // `people/person` is also a common public editorial route. Other
        // containers explicitly describe a private/customer record.
        explicitPrivateContext: !/^(?:people|persons?)$/iu.test(match[1]),
      }));
    const allSegments = pathSegments
      .map((slug) => ({ slug, explicitPrivateContext: false }));
    for (const { slug: rawSlug, explicitPrivateContext } of [
      ...privateRecordSegments,
      ...allSegments,
    ]) {
      const slug = rawSlug.toLowerCase();
      const tokens = slug.split(/[-_]/).filter(Boolean);
      const hasRecordSuffix = PRIVATE_RECORD_SLUG_SUFFIX_PATTERN.test(slug);
      const identityTokens = slug
        .replace(PRIVATE_RECORD_SLUG_SUFFIX_PATTERN, "")
        .split(/[-_]/)
        .filter(Boolean);
      const hasGenericSubject =
        GENERIC_SOURCE_SUBJECT_PATTERN.test(tokens[0] || "") ||
        GENERIC_SOURCE_SUBJECT_PATTERN.test(tokens.slice(0, 2).join(" "));
      const hasHealth = containsHealthInformation(tokens.join(" "));
      // Paths explicitly scoped to private/customer records are unsafe even
      // when the record slug is opaque (for example `record-7f31`). Public
      // education routes with a clear generic subject remain usable.
      if (explicitPrivateContext) {
        if (hasHealth) return "sensitive_personal_health";
        ambiguousIdentity = true;
        continue;
      }
      if (
        tokens.length < 2 ||
        hasGenericSubject ||
        !isSyntacticallyBoundPrivateNameCandidate(tokens.slice(0, 2).join(" "))
      ) {
        continue;
      }
      const publicNameBound = (Array.isArray(allowedPublicPersonNames)
        ? allowedPublicPersonNames : []).some((name) => {
        const publicTokens = normalizePrivacyText(name).trim().split(/\s+/);
        return (
          publicTokens.length > 0 &&
          publicTokens.length === identityTokens.length &&
          publicTokens.every((token, index) => token === identityTokens[index])
        );
      });
      if (publicNameBound && !hasHealth && !explicitPrivateContext) continue;
      if (!explicitPrivateContext && !hasRecordSuffix && !hasHealth) continue;
      if (hasHealth) {
        return "sensitive_personal_health";
      }
      ambiguousIdentity = true;
    }
  }
  return ambiguousIdentity ? "ambiguous_person_identity" : null;
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const redactDirectIdentifiers = (value, privateNames = []) => {
  let redacted = boundedText(value, 5000);
  const before = redacted;
  for (const pattern of CONTEXTUAL_PRIVATE_NAME_PATTERNS) {
    redacted = redacted.replace(pattern, (...match) => {
      const prefix = match[1];
      return `${prefix}[đã ẩn tên]`;
    });
  }
  for (const name of privateNames) {
    redacted = redacted.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`,
        "giu",
      ),
      "[đã ẩn tên]",
    );
  }
  redacted = redacted
    .replace(EMAIL_PATTERN, "[đã ẩn email]")
    .replace(INTERNATIONAL_PHONE_PATTERN, "[đã ẩn số điện thoại]")
    .replace(PHONE_PATTERN, "[đã ẩn số điện thoại]")
    .replace(URL_PATTERN, "[đã ẩn đường dẫn]")
    .replace(SECRET_PATTERN, "[đã ẩn thông tin xác thực]")
    .replace(LABELED_IDENTIFIER_PATTERN, "[đã ẩn mã định danh]")
    .replace(LONG_IDENTIFIER_PATTERN, "[đã ẩn mã định danh]")
    .replace(ADDRESS_PATTERN, "[đã ẩn địa chỉ]");
  return { text: redacted, redacted: redacted !== before };
};

export function prepareExternalKnowledgeQuery(
  value,
  { allowedPublicPersonNames = [] } = {},
) {
  const query = boundedText(value, 500);
  if (!query) return { eligible: false, reason: "empty_query" };
  const resolvedPublicPersonNames = Array.isArray(allowedPublicPersonNames)
    ? [...new Set(allowedPublicPersonNames)]
    : [];
  if (
    containsSensitivePersonalHealth(query, "", resolvedPublicPersonNames, {
      allowCallerVettedPublicDateOfBirth: true,
    })
  ) {
    return { eligible: false, reason: "sensitive_personal_health" };
  }
  if (
    containsTimeSensitivePrivatePersonRequest(query, resolvedPublicPersonNames)
  ) {
    return { eligible: false, reason: "ambiguous_person_identity" };
  }

  const contextualPrivateNames = extractContextualPrivateNames(query);
  const unboundPrivateNames = extractUnboundPrivateNames(
    query,
    resolvedPublicPersonNames,
  ).filter(
    (name) =>
      !contextualPrivateNames.some(
        (contextualName) =>
          normalizePrivacyText(contextualName).trim() ===
          normalizePrivacyText(name).trim(),
      ),
  );
  if (unboundPrivateNames.length > 0) {
    return { eligible: false, reason: "ambiguous_person_identity" };
  }

  const safeQuery = redactDirectIdentifiers(
    query,
    contextualPrivateNames,
  );
  if (!safeQuery.text) {
    return { eligible: false, reason: "empty_after_redaction" };
  }
  return {
    eligible: true,
    query: safeQuery.text.slice(0, 500),
    redacted: safeQuery.redacted,
  };
}

export function prepareKnowledgeRetrievalQuery(value) {
  const query = boundedText(value, 500);
  if (!query) return { eligible: false, reason: "empty_query" };

  const allowedPublicPersonNames = getPublicPersonLookupNames(query);
  if (containsSensitivePersonalHealth(query, "", allowedPublicPersonNames)) {
    return { eligible: false, reason: "sensitive_personal_health" };
  }
  if (
    containsTimeSensitivePrivatePersonRequest(query, allowedPublicPersonNames)
  ) {
    return { eligible: false, reason: "ambiguous_person_identity" };
  }

  const privateNames = [
    ...new Set([
      ...extractContextualPrivateNames(query),
      ...extractUnboundPrivateNames(query, allowedPublicPersonNames),
    ]),
  ];
  const safeQuery = redactDirectIdentifiers(query, privateNames);
  if (!safeQuery.text) {
    return { eligible: false, reason: "empty_after_redaction" };
  }
  return {
    eligible: true,
    query: safeQuery.text.slice(0, 500),
    redacted: safeQuery.redacted,
  };
}

const hasDirectKnowledgeIdentifier = (value) => {
  const patterns = [
    EMAIL_PATTERN,
    INTERNATIONAL_PHONE_PATTERN,
    PHONE_PATTERN,
    SECRET_PATTERN,
    CREDENTIAL_ASSIGNMENT_PATTERN,
    LABELED_IDENTIFIER_PATTERN,
    LONG_IDENTIFIER_PATTERN,
    ADDRESS_PATTERN,
  ];
  return decodePrivacyCandidates(value).some(
    (candidate) =>
      hasCredentialUrlParameter(candidate) ||
      patterns.some((pattern) =>
        new RegExp(pattern.source, pattern.flags.replaceAll("g", "")).test(
          candidate,
        ),
      ),
  );
};

/**
 * Kiểm tra toàn bộ nội dung có thể được đưa từ Knowledge Entry vào embedding
 * hoặc system prompt. Câu hỏi là nơi duy nhất được phép bind danh tính công
 * chúng; answer/tag/source metadata không thể tự nâng một tên riêng thành public.
 */
export function validateKnowledgeEntryPrivacy(entry = {}) {
  const question = String(entry?.question || "");
  const allowedPublicPersonNames = getPublicPersonLookupNames(question);
  const contentFields = [
    question,
    entry?.matchedQuestion,
    entry?.answer,
    ...(Array.isArray(entry?.variants)
      ? entry.variants.map((variant) => variant?.text ?? variant)
      : []),
    ...(Array.isArray(entry?.tags) ? entry.tags : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const sourceMetadataFields = (Array.isArray(entry?.sources)
    ? entry.sources.flatMap((source) => [source?.title, source?.publisher])
    : []
  )
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const sourceUrlFields = (Array.isArray(entry?.sources)
    ? entry.sources.map((source) => source?.url)
    : []
  )
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const combined = contentFields.join("\n").normalize("NFKC");

  const sensitiveHealthOptions = {
    allowCallerVettedPublicDateOfBirth: true,
  };
  if (
    contentFields.some((field) =>
      containsSensitivePersonalHealth(
        field,
        "",
        allowedPublicPersonNames,
        sensitiveHealthOptions,
      ),
    ) ||
    containsSensitivePersonalHealth(
      combined,
      "",
      allowedPublicPersonNames,
      sensitiveHealthOptions,
    )
  ) {
    return { valid: false, reason: "sensitive_personal_health" };
  }
  if (
    [...contentFields, ...sourceMetadataFields, ...sourceUrlFields].some(
      hasDirectKnowledgeIdentifier,
    )
  ) {
    return { valid: false, reason: "direct_identifier" };
  }

  const contextualPrivateNames = extractContextualPrivateNames(combined);
  const unboundPrivateNames = extractUnboundPrivateNames(
    combined,
    allowedPublicPersonNames,
  );
  if (contextualPrivateNames.length > 0 || unboundPrivateNames.length > 0) {
    return { valid: false, reason: "ambiguous_person_identity" };
  }

  // Metadata nguồn dùng heuristic hẹp: tên có cue riêng tư, tên phổ biến hoặc
  // tên đứng trước predicate cá nhân. Không coi mọi Title Case organization là
  // người, tránh chặn ACSM/BJSM/NSCA/Nike và tên tạp chí công khai.
  const sourceMetadata = sourceMetadataFields.join("\n").normalize("NFKC");
  if (sourceMetadata) {
    const sourcePrivateNames = extractSourceMetadataPrivateNames(
      sourceMetadataFields,
      allowedPublicPersonNames,
    );
    const sourceHasPrivateContext =
      sourcePrivateNames.length > 0 ||
      PERSONAL_CONTEXT_PATTERN.test(normalizePrivacyText(sourceMetadata)) ||
      EXPLICIT_PRIVATE_RECORD_SUBJECT_PATTERN.test(
        normalizePrivacyText(sourceMetadata),
      );
    if (
      sourceHasPrivateContext &&
      sourceMetadataFields.some(containsPersonalHealthData)
    ) {
      return { valid: false, reason: "sensitive_personal_health" };
    }
    if (sourcePrivateNames.length > 0) {
      return { valid: false, reason: "ambiguous_person_identity" };
    }
  }

  for (const sourceUrl of sourceUrlFields) {
    const privateRecordRisk = sourceUrlPrivateRecordRisk(
      sourceUrl,
      allowedPublicPersonNames,
    );
    if (privateRecordRisk) return { valid: false, reason: privateRecordRisk };
  }

  return { valid: true };
}

export function prepareKnowledgeSuggestionPair({
  conversationId,
  question,
  answer,
  questionIndex,
  answerIndex,
  capturedAt = new Date(),
}) {
  if (answer?.feedback === "down") {
    return { eligible: false, reason: "downvoted" };
  }

  const rawQuestion = boundedText(question?.content, 500);
  const rawAnswer = boundedText(answer?.content, 5000);
  if (containsSensitivePersonalHealth(rawQuestion, rawAnswer)) {
    return { eligible: false, reason: "sensitive_personal_health" };
  }

  const combined = `${rawQuestion}\n${rawAnswer}`;
  // Chỉ câu hỏi gốc của user được phép thiết lập public-person boundary.
  // Assistant/model output là untrusted data và không thể tự thêm nhãn như
  // “vận động viên” để biến một tên riêng tư thành public identity.
  const contextualPublicNames = getPublicPersonLookupNames(rawQuestion);
  if (
    containsTimeSensitivePrivatePersonRequest(
      rawQuestion,
      contextualPublicNames,
    )
  ) {
    return { eligible: false, reason: "ambiguous_person_identity" };
  }
  const privateNames = [
    ...new Set([
      ...extractContextualPrivateNames(combined),
      ...extractUnboundPrivateNames(combined, contextualPublicNames),
    ]),
  ];
  const safeQuestion = redactDirectIdentifiers(rawQuestion, privateNames);
  const safeAnswer = redactDirectIdentifiers(rawAnswer, privateNames);
  if (!safeQuestion.text || !safeAnswer.text) {
    return { eligible: false, reason: "empty_after_redaction" };
  }

  return {
    eligible: true,
    question: safeQuestion.text.slice(0, 500),
    answer: safeAnswer.text.slice(0, 5000),
    redacted: safeQuestion.redacted || safeAnswer.redacted,
    source: buildConversationKnowledgeSource({
      conversationId,
      question,
      answer,
      questionIndex,
      answerIndex,
      capturedAt,
    }),
  };
}
