import { describe, expect, it } from "vitest";
import { getPublicPersonLookupNames, validateKnowledgeEntryPrivacy } from "../knowledgePrivacy.js";

describe("Knowledge privacy: athlete role abbreviations", () => {
  it.each(["VĐV", "VDV", "vđv", "vdv"])("binds the role %s independently of the name", (role) => {
    const question = `Nữ ${role} Trần Thu Hương thi đấu ở hạng mục nào?`;
    expect(getPublicPersonLookupNames(question)).toEqual(["Trần Thu Hương"]);
    expect(validateKnowledgeEntryPrivacy({
      question,
      answer: "Trần Thu Hương thi đấu thể hình.",
      variants: ["Trần Thu Hương thi đấu giải nào?"],
    })).toEqual({ valid: true });
  });

  it.each([
    "Khách hàng VĐV Trần Thu Hương tập gì?",
    "VĐV Trần Thu Hương là khách hàng của tôi.",
  ])("retains the private-label rejection: %s", (question) => {
    expect(getPublicPersonLookupNames(question)).toEqual([]);
    expect(validateKnowledgeEntryPrivacy({ question }).valid).toBe(false);
  });

  it("does not bind an athlete identity introduced by the answer", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "Thành tích thể hình là gì?",
      answer: "VĐV Trần Thu Hương thi đấu thể hình.",
    }).valid).toBe(false);
  });

  it("does not bind a second private person through the role", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "VĐV Trần Thu Hương thi đấu ở đâu?",
      answer: "Khách hàng Nguyễn Văn Bình bị tiểu đường.",
    }).valid).toBe(false);
  });

  it("binds a parenthetical alias declared beside the question's public full name", () => {
    const question = "VĐV Trần Thu Hương (Hương Nhỏ) thi đấu ở đâu?";
    expect(getPublicPersonLookupNames(question)).toEqual(["Trần Thu Hương", "Hương Nhỏ"]);
    expect(validateKnowledgeEntryPrivacy({ question, variants: ["Hương Nhỏ là ai?"] })).toEqual({ valid: true });
  });

  it("does not bind an alias supplied only by the answer", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "VĐV Trần Thu Hương thi đấu ở đâu?",
      answer: "Trần Thu Hương (Hương Nhỏ) thi đấu thể hình.",
    }).valid).toBe(false);
  });

  it("keeps an alias's private health assertion blocked", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "VĐV Trần Thu Hương (Hương Nhỏ) thi đấu ở đâu?",
      answer: "Khách hàng Hương Nhỏ bị tiểu đường.",
    }).valid).toBe(false);
  });
});
