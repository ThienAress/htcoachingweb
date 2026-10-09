import { describe, expect, it } from "vitest";
import {
  prepareKnowledgeRetrievalQuery,
  validateKnowledgeEntryPrivacy,
} from "../knowledgePrivacy.js";

describe("Knowledge privacy: general fitness terms", () => {
  it.each([
    "Skinny Fat là gì?",
    "skinny fat là gì?",
    "Tạng người Skinny Fat nên tập trung Bulking hay Cutting?",
    "Nên tập trung Cutting hay Bulking?",
  ])("accepts a general concept question: %s", (question) => {
    expect(validateKnowledgeEntryPrivacy({ question }).valid).toBe(true);
  });

  it.each(["Skinny Fat", "skinny fat"])(
    "accepts a general BMI explanation for %s",
    (term) => {
      expect(validateKnowledgeEntryPrivacy({
        question: `${term} là gì?`,
        answer: `${term} là tình trạng cơ thể có chỉ số khối (BMI) ở mức bình thường hoặc thấp.`,
      }).valid).toBe(true);
    },
  );

  it("keeps the general concept intact before external retrieval", () => {
    expect(prepareKnowledgeRetrievalQuery("Skinny Fat là gì?")).toEqual({
      eligible: true,
      query: "Skinny Fat là gì?",
      redacted: false,
    });
  });

  it.each([
    "Khách hàng Skinny Fat bị HIV.",
    "Skinny Fat là khách hàng của tôi.",
    "Biệt danh của khách hàng là Skinny Fat.",
    "Bình thường uống insulin.",
    "Học viên Bình thường hỏi về BMI.",
    "BMI của Bình ở mức bình thường.",
    "Skinny Fat là gì? Khách hàng Bình có BMI 31.",
    "Tôi thuộc tạng người Skinny Fat và đang điều trị tiểu đường.",
    "Khách hàng Bulking hay Cutting có BMI 31.",
    "Bulking là khách hàng của tôi.",
    "Cutting là học viên của tôi.",
    "Tạng người Skinny Fat của khách hàng Nguyễn Văn A bị HIV.",
  ])("continues to reject private identity/health: %s", (answer) => {
    expect(validateKnowledgeEntryPrivacy({
      question: "Skinny Fat là gì?",
      answer,
    }).valid).toBe(false);
  });

  it("continues to reject an identifier in a concept answer", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "Skinny Fat là gì?",
      answer: "Liên hệ example@example.com để nhận thông tin.",
    }).valid).toBe(false);
  });
});
