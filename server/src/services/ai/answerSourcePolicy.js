const normalizeQuestion = (value) => String(value || "")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/giu, "d")
  .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/\s+(?:la gi|nhu the nao)$/, "");

// Vector similarity alone does not prove support for a question. Cite only
// when the published root or its reviewed variant identifies the same question.
export const selectCitationKnowledgeEntries = (results, question) => {
  const normalized = normalizeQuestion(question);
  if (!normalized) return [];
  return (Array.isArray(results) ? results : []).slice(0, 3).filter((entry) =>
    [entry?.question, entry?.matchedQuestion].some((value) =>
      value && normalizeQuestion(value) === normalized,
    ),
  );
};

export const answerNeedsKnowledgeCitation = (decision, answer) => {
  if (decision?.risk !== "low" || decision.evidence !== "internal_kb") return false;
  if (decision.preferredTool || decision.reasonCodes?.includes("workout_creation")) return false;
  const plainAnswer = String(answer || "").replace(/[*_`]/g, "");
  if (/chưa (?:thể|đủ|tìm)|bổ sung (?:thông tin|dữ liệu|số đo)|giới hạn xử lý|thử lại/iu.test(plainAnswer)) return false;
  const guidelineClaims = plainAnswer.split(/(?<=[.!?;])\s*|\n(?=\s*theo\s)/iu)
    .map((clause) => clause.trim()).filter((clause) =>
      !clause.endsWith("?") &&
      !/(?:chưa|cần|còn phải)\s+(?:xác minh|kiểm chứng)|(?:bạn|mình|tôi)\s+(?:hãy\s+)?(?:cho biết|cung cấp|muốn (?:biết|tìm))/iu.test(clause),
    );
  const attributedGuideline = guidelineClaims.some((clause) =>
    /^theo\s+nguồn chính thức\s*,\s*\S/iu.test(clause) ||
    /^theo\s+(?:(?:các|những)\s+)?(?:khuyến nghị|khuyến cáo|hướng dẫn)[^.!?]{0,80}\b(?:WHO|AAOS|Tổ chức Y tế Thế giới|World Health Organization)\b/iu.test(clause),
  ) || /(?:theo(?:\s+(?:khuyến nghị|hướng dẫn)(?:\s+của)?)?\s+(?:WHO|AAOS|Tổ chức Y tế Thế giới|World Health Organization)\b|\b(?:WHO|AAOS|Tổ chức Y tế Thế giới|World Health Organization)(?:\s*\((?:WHO|AAOS)\))?\s+(?:khuyến nghị|recommends?))/iu.test(guidelineClaims.join(" "));
  return decision.reasonCodes?.some((reason) => ["source_requested", "research_claim"].includes(reason)) ||
    attributedGuideline ||
    /theo (?:nghiên cứu|bằng chứng)|tổng quan hệ thống|phân tích gộp|systematic review|meta-analysis/iu.test(plainAnswer);
};

const normalizeSourceUri = (value) => {
  try {
    const url = new URL(String(value || "").replaceAll("&amp;", "&"));
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};

// A provider may still copy a URL from retrieved background data. Strip those
// exact references at delivery; ordinary navigation links keep their behavior.
export const stripUnselectedKnowledgeCitations = (value, {
  retrievedSources = [], allowedSources = [],
} = {}) => {
  const allowed = new Set(allowedSources.map((source) => normalizeSourceUri(source.uri)));
  const rejected = new Set(retrievedSources.map((source) => normalizeSourceUri(source.uri))
    .filter((uri) => uri && !allowed.has(uri)));
  if (!rejected.size) return String(value || "");
  const shouldStrip = (uri) => rejected.has(normalizeSourceUri(uri));
  return String(value || "")
    .replace(/\[[^\]\n]*\]\(<?(https?:\/\/[^\s)>]+)>?\)/giu,
      (link, uri) => shouldStrip(uri) ? "" : link)
    .replace(/https?:\/\/[^\s<>*)]+/giu,
      (uri) => shouldStrip(uri.replace(/[.,;]+$/, "")) ? "" : uri)
    .replace(/^\s*(?:📎\s*)?\*?Nguồn(?: tham khảo)?:\s*[\s*·,;]*$/gimu, "")
    .replace(/\n{3,}/g, "\n\n").trim();
};
