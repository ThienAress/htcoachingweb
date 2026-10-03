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
