/**
 * Friendly opening and closing for a grounded web answer.
 *
 * Everything added here is conversational or general coaching advice, never a fact about the
 * subject: each factual sentence still comes from a verified source quote. The wording follows
 * the user's own tone ("bro" only when the user used it).
 */

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

const KNOW_QUESTION_PATTERN = /\bbiet\b[^?!.]{0,120}\bkhong\b/;
const TRAINING_OR_DIET_PATTERN =
  /\b(?:tap luyen|luyen tap|tap gi|ky luat|than hinh|the hinh|co bap|an uong|che do an|dinh duong|routine|lich tap)\b/;
const CASUAL_PATTERN = /\bbro\b/;

const OPENINGS_PLAIN = Object.freeze([
  "Mình tổng hợp nhanh từ các nguồn tìm được nhé:",
  "Đây là những gì mình tìm được từ các nguồn:",
  "Mình đã tra và tóm tắt lại cho bạn nhé:",
]);
const OPENINGS_CASUAL = Object.freeze([
  "Để mình tổng hợp nhanh cho bro nhé:",
  "Mình tra xong rồi đây bro:",
  "Đây là những gì mình tìm được cho bro nè:",
]);

const CLOSING =
  "**Điều đáng học hỏi**\n\n" +
  "Đừng sao chép y nguyên lịch tập của vận động viên chuyên nghiệp: họ thường có đội ngũ y học thể thao " +
  "và nền tảng thể lực nhiều năm hỗ trợ. Điều áp dụng được là tập đều đặn, tăng tải từ từ " +
  "và dành thời gian cho phục hồi.";

const closingInvite = (casual) =>
  casual
    ? "Bro muốn mình gợi ý lịch tập hoặc thực đơn hợp với mục tiêu của bro không? 💪"
    : "Bạn muốn mình gợi ý lịch tập hoặc thực đơn hợp với mục tiêu của bạn không? 💪";

const pick = (options, seed) => {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return options[hash % options.length];
};

export function frameGroundedWebAnswer(text, message) {
  const body = String(text || "").trim();
  if (!body) return body;
  const asked = fold(message);
  const casual = CASUAL_PATTERN.test(asked);
  const opening = KNOW_QUESTION_PATTERN.test(asked)
    ? `Biết chứ${casual ? " bro" : ""}! 🔥 Mình tổng hợp từ các nguồn tìm được nhé:`
    : pick(casual ? OPENINGS_CASUAL : OPENINGS_PLAIN, asked);
  const parts = [opening, body];
  if (TRAINING_OR_DIET_PATTERN.test(asked)) parts.push(CLOSING, closingInvite(casual));
  return parts.join("\n\n");
}
