import { describe, expect, it } from "vitest";
import { bindSupportedKnowledgeClaims } from "../knowledgeClaimCitation.js";

const uri = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
const claim = "Người trưởng thành nên đạt ít nhất 150 phút hoạt động thể lực cường độ vừa mỗi tuần.";
const decision = { risk: "low", evidence: "internal_kb", reasonCodes: [] };
const entry = {
  question: "Tập luyện mỗi tuần bao nhiêu phút?", answer: `Theo nguồn chính thức, ${claim.toLocaleLowerCase("vi")}`,
  status: "published", reviewStatus: "reviewed", evidenceLevel: "source_backed", category: "general",
  sources: [{ type: "official", title: "Physical activity", publisher: "WHO", url: uri, evidenceTier: "primary" }],
};
const bind = (content, overrides = {}) => bindSupportedKnowledgeClaims(content, { entries: [entry], decision, ...overrides });

describe("reviewed factual clause citations", () => {
  it.each([claim, `**${claim}**`, claim.replace("150", "**150**"), `Theo WHO, ${claim.toLocaleLowerCase("vi")}`, claim.replaceAll(" ", "  ")])(
    "cites an intact supported fact with presentation differences: %s", (content) => {
      expect(bind(content)).toEqual({ content: `${content} [Nguồn 1](<${uri}>)`, sources: [{ title: "Physical activity", uri }] });
    },
  );
  it.each([
    claim.replace("150", "75"), claim.replace("tuần", "ngày"), claim.replace("vừa", "mạnh"),
    claim.replace("Người trưởng thành", "Trẻ em"), claim.replace("nên đạt", "không nên đạt"),
    claim.replace("ít nhất", "tối đa"), claim.replace("phút", "giờ"), claim.replace("150", "150–300"),
    claim.replace("150", "15*0"), claim.replace("150", "1_50"), claim.replace("150", "15`0"),
    claim.replace("150", "1**5**0"),
    claim.replace(/\.$/, "?"), "Bạn có thể đi bộ nhẹ 20 phút nếu thấy phù hợp.",
  ])("does not treat a changed fact or ordinary advice as supported: %s", (content) => {
    expect(bind(content)).toEqual({ content, sources: [] });
  });
  it.each([
    { ...entry, status: "draft" }, { ...entry, reviewStatus: "needs_review" },
    { ...entry, reviewDueAt: "2000-01-01T00:00:00.000Z" }, { ...entry, evidenceLevel: "legacy_unverified" },
    { ...entry, sources: [] }, { ...entry, answer: "Theo nguồn chính thức, protein hỗ trợ duy trì cơ bắp trong nhiều điều kiện vận động." },
  ])("does not elevate unreviewed, stale or unrelated evidence", (result) => {
    expect(bind(claim, { entries: [result] })).toEqual({ content: claim, sources: [] });
  });
  it.each([
    { ...decision, risk: "high_stakes" }, { ...decision, evidence: "model_prior" },
    { ...decision, preferredTool: "calculate_tdee" }, { ...decision, reasonCodes: ["workout_creation"] },
  ])("keeps risk and tool boundaries", (route) => {
    expect(bind(claim, { decision: route })).toEqual({ content: claim, sources: [] });
  });
  it("does not cite a copied factual clause after an explicit verification failure", () => {
    const content = `Mình chưa xác minh được số liệu này. ${claim}`;
    expect(bind(content)).toEqual({ content, sources: [] });
  });
  it("attaches a source only to the supported sentence before an unsupported sentence", () => {
    const extra = "Trẻ em phải vận động cường độ mạnh 999 phút mỗi ngày.";
    expect(bind(`${claim} ${extra}`).content).toBe(`${claim} [Nguồn 1](<${uri}>) ${extra}`);
  });
  it("removes a copied source footer before attaching the scoped link", () => {
    expect(bind(`${claim}\n\nNguồn: [WHO](${uri})`).content).toBe(`${claim} [Nguồn 1](<${uri}>)`);
  });
  it("omits a source that cannot fit within the response limit", () => {
    expect(bind(claim, { maxCharacters: claim.length + 5 })).toEqual({ content: claim, sources: [] });
  });
  it("keeps at most three sources across different supported clauses", () => {
    const second = "Theo nguồn chính thức, người trưởng thành nên duy trì một chế độ vận động phù hợp mỗi tuần.";
    const sources = (label) => [1, 2, 3].map(index => ({ ...entry.sources[0], url: `https://example.org/${label}/${index}` }));
    const result = bind(`${claim} ${second}`, { entries: [{ ...entry, sources: sources("one") }, { ...entry, answer: second, sources: sources("two") }] });
    expect(result.sources).toHaveLength(3);
    expect(result.content).not.toContain("https://example.org/two");
  });
});
