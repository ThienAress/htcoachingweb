import { describe, expect, it } from "vitest";

import { buildCitedWebAnswer } from "../webEvidence.js";

const evidence = [1, 2, 3, 4].map((n) => ({
  id: `source_${n}`,
  title: `Nguon ${n} (site${n}.com)`,
  uri: `https://site${n}.com/page`,
  snippets: [`LeBron James has fact number ${n} in the verified snippet text for source ${n}.`],
}));
const quote = (n) => `fact number ${n} in the verified snippet text`;
const segment = (group, text, n) => ({
  group,
  text,
  supports: [{ sourceId: `source_${n}`, quote: quote(n) }],
});

describe("grouped web answers", () => {
  it("joins facts of one topic into a paragraph with a single set of sources", () => {
    const answer = {
      segments: [
        segment("Thành tích", "LeBron James vô địch NBA.", 1),
        segment("Thành tích", "Anh cũng giành giải thưởng cá nhân.", 2),
        segment("Tập luyện", "Anh tập năm ngày mỗi tuần.", 3),
        segment("Tập luyện", "Anh có một buổi phục hồi riêng.", 4),
      ],
    };
    const result = buildCitedWebAnswer(answer, evidence, "thành tích và tập luyện");
    const paragraphs = result.text.split("\n\n");
    expect(paragraphs[0]).toBe("**Thành tích**");
    expect(paragraphs[1]).toContain("LeBron James vô địch NBA. Anh cũng giành giải thưởng cá nhân.");
    expect(paragraphs[1].match(/\]\(</g)).toHaveLength(2);
    expect(paragraphs[3].match(/\]\(</g)).toHaveLength(2);
    expect(result.sources).toHaveLength(4);
  });

  it("never attaches more than three sources to one paragraph", () => {
    const answer = {
      segments: [1, 2, 3, 4].map((n) => segment("Tập luyện", `Câu số ${n}.`, n)),
    };
    const result = buildCitedWebAnswer(answer, evidence, "tập luyện");
    expect(result.text.match(/\]\(</g)).toHaveLength(3);
    expect(result.text.startsWith("**")).toBe(false);
  });

  it("still drops a fact whose quote is not in the source", () => {
    const answer = {
      segments: [
        segment("Thành tích", "Câu có nguồn.", 1),
        { group: "Thành tích", text: "Câu bịa.", supports: [{ sourceId: "source_1", quote: "a quote that is not in the snippet at all" }] },
      ],
    };
    const result = buildCitedWebAnswer(answer, evidence, "thành tích");
    expect(result.text).toContain("Câu có nguồn.");
    expect(result.text).not.toContain("Câu bịa.");
  });

  it("works without any group", () => {
    const answer = { segments: [{ text: "Một câu.", supports: [{ sourceId: "source_1", quote: quote(1) }] }] };
    expect(buildCitedWebAnswer(answer, evidence, "x").text).toContain("Một câu.");
  });
});
