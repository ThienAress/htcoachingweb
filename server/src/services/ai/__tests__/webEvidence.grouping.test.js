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
const linkCount = (text) => (text.match(/\]\(</g) || []).length;

describe("grouped web answers", () => {
  it("joins facts of one topic into a paragraph and closes it with its sources", () => {
    const answer = {
      segments: [
        segment("Thành tích", "LeBron James vô địch NBA.", 1),
        segment("Thành tích", "Anh cũng giành giải thưởng cá nhân.", 2),
        segment("Tập luyện", "Anh tập năm ngày mỗi tuần.", 3),
      ],
    };
    const result = buildCitedWebAnswer(answer, evidence, "thành tích và tập luyện");
    const paragraphs = result.text.split("\n\n");
    expect(paragraphs[0]).toBe("**Thành tích**");
    expect(paragraphs[1]).toContain("LeBron James vô địch NBA. Anh cũng giành giải thưởng cá nhân.");
    expect(linkCount(paragraphs[1])).toBe(2);
    expect(paragraphs[2]).toBe("**Tập luyện**");
    expect(linkCount(paragraphs[3])).toBe(1);
    expect(result.sources).toHaveLength(3);
  });

  it("never uses more than three distinct sources in one answer", () => {
    const answer = {
      segments: [1, 2, 3, 4].map((n) =>
        segment(n < 3 ? "Thành tích" : "Tập luyện", `Câu số ${n}.`, n)),
    };
    const result = buildCitedWebAnswer(answer, evidence, "thành tích và tập luyện");
    expect(result.sources).toHaveLength(3);
    expect(linkCount(result.text)).toBeLessThanOrEqual(3);
  });

  it("prefers the sources that back the most facts", () => {
    const shared = (n) => ({
      group: "Tập luyện",
      text: `Câu chung ${n}.`,
      supports: [
        { sourceId: "source_1", quote: quote(1) },
        { sourceId: `source_${n}`, quote: quote(n) },
      ],
    });
    const result = buildCitedWebAnswer(
      { segments: [shared(2), shared(3), shared(4)] },
      evidence,
      "tập luyện",
    );
    expect(result.sources.map((source) => source.uri)).toEqual(["https://site1.com/page"]);
    expect(result.text.match(/Câu chung/g)).toHaveLength(3);
  });

  it("still drops a fact whose quote is not in the source", () => {
    const answer = {
      segments: [
        segment("Thành tích", "Câu có nguồn.", 1),
        {
          group: "Thành tích",
          text: "Câu bịa.",
          supports: [{ sourceId: "source_1", quote: "a quote that is not in the snippet at all" }],
        },
      ],
    };
    const result = buildCitedWebAnswer(answer, evidence, "thành tích");
    expect(result.text).toContain("Câu có nguồn.");
    expect(result.text).not.toContain("Câu bịa.");
  });

  it("works without any group", () => {
    const answer = {
      segments: [{ text: "Một câu.", supports: [{ sourceId: "source_1", quote: quote(1) }] }],
    };
    expect(buildCitedWebAnswer(answer, evidence, "x").text).toContain("Một câu.");
  });
});
