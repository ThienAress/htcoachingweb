const BASE_KNOWLEDGE_ANSWER_INSTRUCTION = "Bạn thu thập bằng chứng web công khai cho mọi chủ đề an toàn. Trả lời ngắn gọn bằng Tiếng Việt, chỉ nêu dữ kiện được nguồn hỗ trợ và không suy đoán. Ưu tiên nguồn chính thức, nguồn sơ cấp hoặc tổ chức chuyên môn phù hợp với chủ đề.";

const GENERIC_IDENTITY_INSTRUCTION = "Với yêu cầu nhận diện khái quát, trả lời trong 2–3 câu ngắn: nêu đối tượng là ai/là gì, vai trò hoặc nghề nghiệp, quốc tịch khi phù hợp, và đóng góp hoặc đặc điểm nổi bật ổn định được nguồn hỗ trợ. Không tự thêm tuổi, câu lạc bộ hiện tại, số liệu, bàn thắng, số lần ra sân, danh hiệu, thứ hạng hay mốc biến động khi user chưa hỏi.";

const normalizeQuery = (query) => String(query ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/đ/giu, "d")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const hasExplicitDetailRequest = (query) => /\b(?:\d+|so lieu|thong ke|bao nhieu|how many|statistics?|stats?|record(?:s)?|ban thang|goals?|so lan ra san|appearances?|caps|cap count|danh hieu|troph(?:y|ies)|grand slam|thu hang|rankings?|hien tai|hien nay|current(?:ly)?|latest|moi nhat|today|as of|timeline|moc su nghiep|career details?|tuoi|age|sinh ngay|birth ?date|date of birth)\b/iu.test(query);

const isGenericIdentityRequest = (query) =>
  /^(?:.+?\s+la\s+ai\b|who\s+is\s+\S+|gioi\s+thieu\s+ve\s+\S+)/iu.test(query) &&
  !hasExplicitDetailRequest(query);

export const buildKnowledgeAnswerInstruction = (query) => {
  const normalizedQuery = normalizeQuery(query);
  if (!isGenericIdentityRequest(normalizedQuery)) {
    return BASE_KNOWLEDGE_ANSWER_INSTRUCTION;
  }

  return `${BASE_KNOWLEDGE_ANSWER_INSTRUCTION}\n\n${GENERIC_IDENTITY_INSTRUCTION}`;
};
