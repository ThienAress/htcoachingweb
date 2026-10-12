import { describe, expect, it } from "vitest";

import {
  getPublicFigureLookupCandidates,
  prepareExternalKnowledgeQuery,
} from "../knowledgePrivacy.js";

const LEBRON_QUESTION =
  "bạn biết LeBron James không bro, thành tích của anh ấy vang dội như thế nào và anh ấy củng tập luyện rất kỷ luật để có được thân hình săn chắc đúng không";

describe("public figure lookup without a role word", () => {
  it("binds a full public name from a natural question", () => {
    expect(getPublicFigureLookupCandidates(LEBRON_QUESTION)).toEqual(["LeBron James"]);
  });

  it.each([
    ["Taylor thường tập gì để giữ dáng?", "Taylor"],
    ["Lisa có tập gym không?", "Lisa"],
    ["Bạn biết gì về Messi?", "Messi"],
  ])("binds a single public name in %s", (question, name) => {
    expect(getPublicFigureLookupCandidates(question)).toEqual([name]);
  });

  it("lets the bound name through the external query gate", () => {
    const names = getPublicFigureLookupCandidates(LEBRON_QUESTION);
    expect(prepareExternalKnowledgeQuery(LEBRON_QUESTION, { allowedPublicPersonNames: names }))
      .toMatchObject({ eligible: true });
    expect(prepareExternalKnowledgeQuery(LEBRON_QUESTION)).toMatchObject({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
  });

  it.each([
    "học viên Nguyễn Văn An bị tiểu đường, nên ăn gì?",
    "Lisa là khách hàng của tôi, lịch tập của cô ấy thế nào?",
    "bạn tôi Lisa tập gym thế nào?",
    "Nguyễn Văn An đang điều trị ung thư, có nên tập không?",
    "Lisa của tôi tập gì?",
    "vợ tôi Mai muốn giảm cân thì tập gì?",
  ])("does not bind a private subject in %s", (question) => {
    expect(getPublicFigureLookupCandidates(question)).toEqual([]);
  });

  it("keeps health data about a named person blocked at the external gate", () => {
    const question = "Taylor bị tiểu đường type 2 thì nên ăn gì?";
    const names = getPublicFigureLookupCandidates(question);
    expect(prepareExternalKnowledgeQuery(question, { allowedPublicPersonNames: names }).eligible)
      .toBe(false);
  });

  it("returns nothing when no person is named", () => {
    expect(getPublicFigureLookupCandidates("Tôi nên tập ngực mấy buổi một tuần?")).toEqual([]);
  });
});
