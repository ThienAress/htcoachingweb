const BASE_KNOWLEDGE_ANSWER_INSTRUCTION = "Bạn thu thập bằng chứng web công khai cho mọi chủ đề an toàn. Trả lời ngắn gọn bằng Tiếng Việt, chỉ nêu dữ kiện được nguồn hỗ trợ và không suy đoán. Ưu tiên nguồn chính thức, nguồn sơ cấp hoặc tổ chức chuyên môn phù hợp với chủ đề.";

const GENERIC_IDENTITY_INSTRUCTION = "Với yêu cầu nhận diện khái quát, trả lời trong 2–3 câu ngắn: nêu đối tượng là ai/là gì, vai trò hoặc nghề nghiệp, quốc tịch khi phù hợp, và đóng góp hoặc đặc điểm nổi bật ổn định được nguồn hỗ trợ. Không tự thêm tuổi, câu lạc bộ hiện tại, số liệu, bàn thắng, số lần ra sân, danh hiệu, thứ hạng hay mốc biến động khi user chưa hỏi.";

const normalizeQuery = (query) => String(query ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/đ/giu, "d")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const IDENTITY_DETAIL_PATTERN = /\b(?:\d+|tuoi|age|born|sinh ngay|sinh nam|hien tai|hien nay|dang (?:choi|thi dau|giu|la)|thi dau cho|choi cho|plays? for|play for|current(?:ly)?|latest|cau lac bo|club|doi truong|captain|ban thang|goals?|so lan ra san|appearances?|danh hieu|troph(?:y|ies)|thu hang|rankings?|giai thuong|awards?|qua bong vang|ballon d.or|chiec giay vang|golden boots?)\b/iu;
const hasExplicitDetailRequest = (query) => IDENTITY_DETAIL_PATTERN.test(query) ||
  /\b(?:so lieu|thong ke|bao nhieu|how many|statistics?|stats?|records?|caps|cap count|grand slam|moi nhat|today|as of|timeline|moc su nghiep|career details?|birth ?date|date of birth)\b/iu.test(query);

const identitySubject = (query) => {
  const match = query.match(/^(.+?)\s+la\s+ai\b(.*)$/iu) ||
    query.match(/^(?:who\s+is|gioi\s+thieu\s+ve)\s+(.+?)(?=\s+(?:and|va|with|currently|today|as of)\b|[?!.;,]|$)(.*)$/iu);
  return match && !hasExplicitDetailRequest(match[2]) ? match[1].trim() : null;
};
const isGenericIdentityRequest = (query) => Boolean(identitySubject(query));

const hasUnrequestedIdentityDetail = (sentence, subject) =>
  IDENTITY_DETAIL_PATTERN.test(normalizeQuery(sentence).replaceAll(subject, "public_subject"));

// Keep verbatim, supported sentences. A model instruction alone cannot enforce
// identity scope, and excluded claims must not consume the citation budget.
export const selectKnowledgeAnswerSegments = (query, segments) => {
  const subject = identitySubject(normalizeQuery(query));
  if (!subject) return segments;
  const segmenter = new Intl.Segmenter("vi", { granularity: "sentence" });
  const selected = [];
  const seen = new Set();
  let remaining = 3;
  for (const segment of segments) {
    const sentences = [...segmenter.segment(segment.text)]
      .map(({ segment: sentence }) => sentence.trim())
      .filter((sentence) => {
        if (!sentence || hasUnrequestedIdentityDetail(sentence, subject)) return false;
        const key = sentence.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, remaining);
    if (sentences.length === 0) continue;
    selected.push({ ...segment, text: sentences.join(" ") });
    remaining -= sentences.length;
    if (remaining === 0) break;
  }
  return selected;
};

export const buildKnowledgeAnswerInstruction = (query) => {
  const normalizedQuery = normalizeQuery(query);
  if (!isGenericIdentityRequest(normalizedQuery)) {
    return BASE_KNOWLEDGE_ANSWER_INSTRUCTION;
  }

  return `${BASE_KNOWLEDGE_ANSWER_INSTRUCTION}\n\n${GENERIC_IDENTITY_INSTRUCTION}`;
};
