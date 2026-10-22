// Nội dung không được đưa vào Knowledge Base hoặc truy vấn tìm kiếm nội bộ: đường dẫn cá cược/trang web đen/link rút gọn
// và đoạn mã (script). Chỉ kiểm đường dẫn/tên miền và cú pháp mã; từ "casino" đứng riêng trong câu chữ thì không bị chặn.
// Đây là danh sách chặn bổ trợ, không thay thế việc admin duyệt nội dung.
const MAX_INSPECTED_LENGTH = 6000;

const URL_LIKE_PATTERN =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`]{1,300}|\b(?:[a-z0-9-]{1,63}\.){1,6}(?:com|net|org|vn|io|club|vip|bet|casino|xyz|top|win|live|cc|co|me|info|site|online|app|fun|games?|pro|asia|link|click|store|shop|tv|ws|tk|ly|gl|gd|id|in|at|us|cn|ru|ml|ga|cf|gq)\b(?:\/[^\s<>"'`]{0,300})?/giu;

const BLACK_SITE_KEYWORD_PATTERN =
  /(?:casino|gambl|betting|nhacai|nha-cai|cacuoc|ca-cuoc|xocdia|xoc-dia|taixiu|tai-xiu|baccarat|roulette|jackpot|slots?(?:88|gacor|game|xo|online|vip)|poker|sbobet|bet365|1xbet|w88|fb88|m88|bk8|kubet|789bet|188bet|fun88|vn88|sunwin|go88|hitclub|b52club|lodeonline|soicau|\d{1,3}x?bet|bet\d{2,3}|xxx|porn|hentai|xnxx|xvideos|pornhub|xhamster|redtube)/iu;

const URL_SHORTENER_HOST_PATTERN =
  /(?:^|[/.@])(?:bit\.ly|bit\.do|tinyurl\.com|t\.co|t\.ly|goo\.gl|shorturl\.at|cutt\.ly|rebrand\.ly|is\.gd|ow\.ly|rb\.gy|s\.id|lnkd\.in|tiny\.cc|v\.gd)(?:[/?#:]|$)/iu;

const SCRIPT_PATTERNS = [
  /<\s*\/?\s*(?:script|iframe|object|embed|svg|style|form|meta|link|base)\b/iu,
  /\b(?:java|vb)\s*script\s*:/iu,
  /\bdata\s*:\s*text\/html/iu,
  /\bon[a-z]{3,20}\s*=\s*["'(]?\s*[\w.$]+\s*\(/iu,
  /\beval\s*\(/iu,
  /\bnew\s+Function\s*\(/iu,
  /\b(?:atob|btoa)\s*\(/iu,
  /\bexpression\s*\(/iu,
  /\binnerHTML\s*=/iu,
  /\bsetTimeout\s*\(\s*['"`]/iu,
  /\bimport\s*\(\s*['"`]/iu,
  /\bdocument\s*\.\s*(?:cookie|write|location|domain)/iu,
  /\bwindow\s*\.\s*location/iu,
  /<\?php|<%[=@]?/iu,
  /\b(?:rm\s+-rf|curl\s+[^|\n]{0,200}\|\s*(?:ba)?sh|wget\s+[^|\n]{0,200}\|\s*(?:ba)?sh|powershell\s+-|cmd\.exe|bash\s+-c|nc\s+-e)\b/iu,
  /\bunion\s+select\b|\bdrop\s+table\b|'\s*or\s+1\s*=\s*1/iu,
  /\b(?:const|let|var)\s+[a-z_$][\w$]*\s*=\s*[^;\n]{0,60};|=>\s*[{(]|\bfunction\s*[\w$]*\s*\([^)]{0,80}\)\s*\{/iu,
];

const ZERO_WIDTH_PATTERN = /[​-‏⁠﻿­]/gu;

const HTML_ENTITY_PATTERN = /&(?:lt|gt|quot|apos|amp|#\d{1,6}|#x[0-9a-f]{1,6});/giu;
const decodeHtmlEntities = (value) =>
  value.replace(HTML_ENTITY_PATTERN, (entity) => {
    const lower = entity.toLowerCase();
    if (lower === "&lt;") return "<";
    if (lower === "&gt;") return ">";
    if (lower === "&quot;") return '"';
    if (lower === "&apos;") return "'";
    if (lower === "&amp;") return "&";
    const code = lower.startsWith("&#x") ? Number.parseInt(lower.slice(3, -1), 16) : Number.parseInt(lower.slice(2, -1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : entity;
  });

const safeDecodeUri = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Gỡ các kiểu che dấu thường gặp: ký tự rộng bằng 0, "[.]", "(.)", dấu chấm CJK, khoảng trắng quanh dấu chấm, "hxxp".
const normalizeForInspection = (value) =>
  safeDecodeUri(
    decodeHtmlEntities(String(value || "").slice(0, MAX_INSPECTED_LENGTH).normalize("NFKC").replace(ZERO_WIDTH_PATTERN, "")),
  )
    .replace(/\s*[[(]\s*\.\s*[\])]\s*/gu, ".")
    .replace(/[。．]/gu, ".")
    .replace(/(?<=[a-z0-9])\s+\.\s+(?=[a-z])/giu, ".")
    .replace(/\bhxxp(s?):/giu, "http$1:");

const urlsIn = (text) => [...text.matchAll(URL_LIKE_PATTERN)].map((match) => match[0]);

export const containsForbiddenKnowledgeContent = (value) => {
  const text = normalizeForInspection(value);
  if (!text) return false;
  if (SCRIPT_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return urlsIn(text).some(
    (url) => BLACK_SITE_KEYWORD_PATTERN.test(url) || URL_SHORTENER_HOST_PATTERN.test(url),
  );
};
