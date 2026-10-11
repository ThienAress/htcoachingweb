import { describe, expect, it } from "vitest";
import { answerNeedsKnowledgeCitation, selectCitationKnowledgeEntries, stripUnselectedKnowledgeCitations } from "../answerSourcePolicy.js";
import { buildJointDiscomfortResponse } from "../jointDiscomfortResponse.js";
import { buildKnowledgeFixturePayload } from "../../../scripts/stagingAiChatAcceptance.http.js";

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
    "Theo khuyến nghị của\nWHO, người trưởng thành nên vận động đều đặn.",
    "Theo hướng dẫn của\n**AAOS**, không nên tập xuyên đau.",
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
    "Theo các khuyến nghị của Tổ chức Y tế Thế giới (WHO), người trưởng thành nên đạt ít nhất 150 phút vận động vừa mỗi tuần.",
    "Theo khuyến nghị hiện hành của Tổ chức Y tế Thế giới (WHO), người trưởng thành nên vận động đều đặn.",
    "Theo khuyến cáo từ Tổ chức Y tế Thế giới (WHO), người trưởng thành nên vận động đều đặn.",
    "Theo những hướng dẫn chính thức của AAOS, không nên tập xuyên đau.",
    "Theo các khuyến nghị của\nWHO, người trưởng thành nên vận động đều đặn.",
    "Mức vận động tham khảo:\nTheo nguồn chính thức, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "## Mức vận động\nTheo nguồn chính thức, người trưởng thành nên vận động đều đặn.",
  ])("retains a source for a declarative guideline attribution with modifiers: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(true);
  });
  it.each([
    "Bạn muốn biết các khuyến nghị của WHO cho nhóm tuổi nào?",
    "Theo các khuyến nghị của WHO, bạn muốn tìm thông tin cho nhóm tuổi nào?",
    "Bạn có thể tìm thêm khuyến nghị của WHO.",
    "Tôi đã đọc khuyến nghị của WHO rồi.",
    "Khuyến nghị của WHO là chủ đề bạn muốn tìm hiểu?",
    "Mình chưa tìm được các khuyến cáo từ WHO; bạn thử lại nhé.",
    "Bạn hãy tìm theo các khuyến nghị của WHO.",
    "Theo các khuyến nghị của WHO,\nbạn muốn tìm thông tin cho nhóm tuổi nào?",
    "Để đối chiếu theo các khuyến nghị của WHO, bạn cho biết nhóm tuổi của mình nhé.",
    "Khuyến nghị của WHO là nội dung mình cần xác minh thêm.",
    "Theo các khuyến nghị của WHO, mình chưa xác minh được con số này.",
    "Theo các khuyến nghị của WHO, bạn hãy cho biết nhóm tuổi của mình nhé.",
  ])("does not cite a guideline mention without an affirmative recommendation: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(false);
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
  it("retains the explicit official-source attribution in the canonical KB fixture", () => {
    const fixture = buildKnowledgeFixturePayload({
      marker: "htcoaching-acceptance:00000000-0000-4000-8000-000000000000",
      sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    });
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, fixture.answer)).toBe(true);
  });
  it.each([
    "Theo nguồn chính thức, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
    "Theo **nguồn chính thức**, người trưởng thành nên đạt ít nhất 150 phút hoạt động vừa mỗi tuần.",
  ])("retains a reviewed source for an explicit official attribution: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(true);
  });
  it.each([
    "Theo nguồn chính thức, bạn muốn biết khuyến nghị cho nhóm tuổi nào?",
    "Mình chưa **tìm** được khuyến nghị theo nguồn chính thức.",
    "Bạn muốn biết thông tin theo nguồn chính thức nào?",
    "Mình chưa xác minh được theo nguồn chính thức.",
    "Bạn có thể tìm thêm theo nguồn chính thức.",
  ])("keeps official-source clarifications or fallback uncited: %s", (answer) => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] }, answer)).toBe(false);
  });
  it("keeps official attribution after an opening sentence and before a follow-up", () => {
    expect(answerNeedsKnowledgeCitation({ risk: "low", evidence: "internal_kb", reasonCodes: [] },
      "Đây là hướng dẫn tham khảo. Theo nguồn chính thức, người trưởng thành nên vận động đều đặn. Bạn muốn bắt đầu bằng đi bộ không?"))
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
