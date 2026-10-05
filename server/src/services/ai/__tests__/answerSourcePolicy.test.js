import { describe, expect, it } from "vitest";
import { answerNeedsKnowledgeCitation, selectCitationKnowledgeEntries, stripUnselectedKnowledgeCitations } from "../answerSourcePolicy.js";
import { buildJointDiscomfortResponse } from "../jointDiscomfortResponse.js";

describe("bounded source selection", () => {
  it("requires the exact root or reviewed matching variant, not vector proximity", () => {
    const irrelevant = { question: "Protein timing", similarity: 0.99 };
    const reviewed = { question: "Squat technique", matchedQuestion: "Cách squat đúng kỹ thuật?" };
    expect(selectCitationKnowledgeEntries([irrelevant, reviewed], "Cách squat đúng kỹ thuật là gì?")).toEqual([reviewed]);
  });
  it("does not cite ordinary intake, tool output, errors or stale model prior", () => {
    const base = { risk: "low", evidence: "internal_kb", reasonCodes: [] };
    expect(answerNeedsKnowledgeCitation(base, "Bạn cho biết mục tiêu và số buổi tập nhé.")).toBe(false);
    expect(answerNeedsKnowledgeCitation({ ...base, preferredTool: "suggest_meal" }, "Theo nghiên cứu...")).toBe(false);
    expect(answerNeedsKnowledgeCitation({ ...base, evidence: "model_prior" }, "Theo nghiên cứu...")).toBe(false);
    expect(answerNeedsKnowledgeCitation(base, "Theo phân tích gộp, kết quả còn phụ thuộc thiết kế nghiên cứu.")).toBe(true);
    expect(answerNeedsKnowledgeCitation(base, "Theo nghiên cứu, bổ sung protein hỗ trợ tổng hợp protein cơ.")).toBe(true);
  });
  it.each([
    "Theo khuyến nghị của Tổ chức Y tế Thế giới (WHO), người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo khuyến nghị của **WHO**, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "**WHO** khuyến nghị người trưởng thành đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo WHO, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo hướng dẫn của **AAOS**, không nên tập xuyên đau.",
  ])("retains a reviewed citation when the answer attributes a guideline: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(true);
  });
  it("keeps ordinary advice and unverified authority claims outside the citation path", () => {
    const base = { risk: "low", evidence: "internal_kb", reasonCodes: [] };
    const authorityClaim = "Theo khuyến nghị của **WHO**, hãy duy trì vận động đều đặn.";
    expect([
      answerNeedsKnowledgeCitation(base, "Bạn có thể đi bộ nhẹ 20 phút nếu thấy phù hợp."),
      answerNeedsKnowledgeCitation(base, "WHO là một tổ chức. Bạn cho biết mục tiêu tập nhé."),
      answerNeedsKnowledgeCitation({ ...base, evidence: "model_prior" }, authorityClaim),
      answerNeedsKnowledgeCitation({ ...base, preferredTool: "calculate_tdee" }, authorityClaim),
      answerNeedsKnowledgeCitation({ ...base, risk: "high_stakes" }, authorityClaim),
      answerNeedsKnowledgeCitation(base, "Mình chưa tìm được khuyến nghị của WHO; bạn thử lại sau nhé."),
    ]).toEqual([false, false, false, false, false, false]);
  });
  it.each([
    "Bạn muốn biết khuyến nghị của WHO về chủ đề nào?",
    "Mình chưa **tìm** được khuyến nghị của WHO.",
    "Bạn muốn biết WHO khuyến nghị gì về vận động?",
    "Theo WHO, bạn muốn tìm khuyến nghị cho nhóm tuổi nào?",
    "**WHO** khuyến nghị gì cho nhóm tuổi của bạn?",
  ])("does not treat a clarification or formatted fallback as a guideline claim: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(false);
  });
  it("retains an attributed claim before a follow-up question", () => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] },
      "Theo WHO, người trưởng thành nên vận động đều đặn.\nBạn muốn bắt đầu bằng đi bộ không?"))
      .toBe(true);
  });
  it("offers a cautious knee response with a verified general reference without externalizing personal input", () => {
    const answer = buildJointDiscomfortResponse("Đầu gối tôi hơi khó chịu khi squat", { risk: "high_stakes", urgency: null });
    expect(answer).toMatch(/dừng|không thể xác định|AAOS/);
    expect(buildJointDiscomfortResponse("Tôi ngất khi squat", { risk: "high_stakes", urgency: "medical_emergency" })).toBeNull();
  });
  it("strips copied background citations while preserving ordinary and selected links", () => {
    const uri = "https://example.org/unrelated?a=1&b=2";
    const allowed = { uri: "https://example.org/relevant" };
    const result = stripUnselectedKnowledgeCitations(
      `Gợi ý chung. [Thực đơn](/mealplan) [dịch vụ](https://htcoachingweb.io.vn). [Nguồn đúng](${allowed.uri})\n\n📎 *Nguồn: [Nguồn sai](<${uri}>) · ${uri}*`,
      { retrievedSources: [{ uri }, allowed], allowedSources: [allowed] },
    );
    expect(result).not.toContain(uri);
    expect(result).toContain("[Thực đơn](/mealplan)");
    expect(result).toContain("https://htcoachingweb.io.vn");
    expect(result).toContain(allowed.uri);
    expect(result).not.toMatch(/📎|Nguồn:.*\*/);
  });
});
