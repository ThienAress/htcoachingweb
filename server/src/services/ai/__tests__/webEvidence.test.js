import { describe, expect, it } from "vitest";
import { buildCitedWebAnswer, selectWebEvidence } from "../webEvidence.js";

const quote = "Adults should do at least 150–300 minutes of moderate-intensity physical activity throughout the week.";
const result = (url, title = "Physical activity", snippets = [quote]) => ({ url, title, snippets });
const body = (...results) => ({ grounding: { generic: results } });

describe("external web evidence boundary", () => {
  it("requires the requested WHO publisher and rejects unsafe, impersonated and duplicate URLs", () => {
    const selected = selectWebEvidence(body(
      result("https://who.int.attacker.example/page"), result("https://127.0.0.1/page"),
      result("https://who.int/page", "Trusted [link](https://evil.example)"),
      result("https://who.int/page#fragment"), result("https://a:pass@who.int/page"),
    ), "Theo khuyến nghị WHO mới nhất?");
    expect(selected).toHaveLength(1);
    expect(selected[0].uri).toBe("https://who.int/page");
    expect(selected[0].title).toContain("(who.int)");
  });

  it("prefers primary sources and fails closed when there is no usable content", () => {
    expect(selectWebEvidence(body(result("https://public.example/page"), result("https://uefa.com/page")),
      "Cristiano Ronaldo là ai?")[0].uri).toBe("https://uefa.com/page");
    expect(selectWebEvidence({ grounding: { generic: [null, result("http://who.int/page")] } }, "WHO"))
      .toEqual([]);
  });

  it("builds citations only from verified quotes and does not admit invented numeric recommendations", () => {
    const evidence = selectWebEvidence(body(result("https://who.int/page")), "WHO");
    const supports = [{ sourceId: "source_1", quote }];
    const answer = buildCitedWebAnswer({ segments: [
      { text: "Người trưởng thành nên vận động 150–300 phút cường độ vừa mỗi tuần.", supports },
      { text: "Khuyến nghị 600 phút.", supports },
      { text: "Tập 150 phút.", supports: [{ sourceId: "source_1", quote: "invented evidence supporting this claim" }] },
      { text: "Tập 150 phút.", supports: [{ sourceId: "unknown_source", quote }] },
    ] }, evidence, "WHO khuyến nghị bao nhiêu phút?");
    expect(answer.text).toContain("150–300");
    expect(answer.text).not.toContain("600");
    expect(answer.sources).toEqual([{ title: "Physical activity (who.int)", uri: "https://who.int/page" }]);
  });

  it("retains generic identity scope and does not cite dropped volatile statistics", () => {
    const snippet = "Cristiano Ronaldo is a Portuguese footballer. He scored 999 goals during his career.";
    const evidence = selectWebEvidence(body(result("https://uefa.com/profile", "Ronaldo", [snippet])), "Ronaldo");
    const supports = [{ sourceId: "source_1", quote: snippet }];
    const answer = buildCitedWebAnswer({ segments: [
      { text: "Cristiano Ronaldo là cầu thủ bóng đá người Bồ Đào Nha.", supports },
      { text: "Anh ghi 999 bàn thắng.", supports },
    ] }, evidence, "Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả lời có nguồn.");
    expect(answer.text).toContain("Bồ Đào Nha");
    expect(answer.text).not.toContain("999");
  });
});
