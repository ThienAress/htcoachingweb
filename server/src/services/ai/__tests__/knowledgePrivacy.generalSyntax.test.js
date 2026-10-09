import { describe, expect, it } from "vitest";
import { validateKnowledgeEntryPrivacy } from "../knowledgePrivacy.js";
import { containsPersonalHealthData } from "../personalHealthData.js";

describe("Knowledge privacy: Vietnamese educational grammar", () => {
  it.each([
    "Không nên tự dùng thực phẩm bổ sung.",
    "Không có cơ sở để hứa kết quả cho mọi trường hợp.",
    "Có nên uống protein ngay sau tập không?",
    "Nên tập cardio trước hay sau tập tạ?",
    "Mới tập có cần dùng đai lưng không?",
    "Đi tập về rồi mới ăn có sao không?",
    "Quên uống protein ngay sau tập có sao không?",
    "Người có gen thể thao kém nên tập ra sao?",
    "Mọi người bảo muốn giảm mỡ thì kiêng tinh bột.",
    "Trái cây nguyên quả thường có nhiều chất xơ.",
    "Đây là thông tin chung cho mọi người.",
    "Tập luyện có thể hỗ trợ cơ bắp.",
  ])("accepts a grammatical educational sentence: %s", (answer) => {
    expect(validateKnowledgeEntryPrivacy({ question: "Tập luyện là gì?", answer })).toEqual({ valid: true });
  });

  it.each([
    "Khách hàng Không cần tập tạ.",
    "Khách hàng Có nên tập tạ.",
    "Khách hàng Người có gen thể thao kém.",
    "Khách hàng cơ bắp muốn tập tạ.",
    "Bảo muốn giảm mỡ.",
    "Nam thường tập tạ.",
    "Bình thường uống insulin.",
    "Tôi có huyết áp 150/95.",
    "Khách hàng mọi người bị tiểu đường.",
  ])("retains explicit identity or health rejection: %s", (answer) => {
    expect(validateKnowledgeEntryPrivacy({ question: "Tập luyện là gì?", answer }).valid).toBe(false);
  });

  it("does not confuse evening time with a personal subject across fields", () => {
    const question = "Buổi tối có bữa ăn nhẹ thì tập tạ ra sao?";
    expect(containsPersonalHealthData(question)).toBe(false);
    expect(validateKnowledgeEntryPrivacy({
      question,
      answer: "Có thể chọn lịch tập phù hợp.",
    })).toEqual({ valid: true });
  });

  it.each([
    "Nghiên cứu không chứng minh cơ chế thải độc cơ bắp.",
    "Vai trò thời điểm ăn sau tập: không có bằng chứng cho một thời hạn cố định.",
  ])("does not turn an educational phrase into a personal assertion: %s", (question) => {
    expect(containsPersonalHealthData(question)).toBe(false);
  });

  it.each(["Tôi có huyết áp 150/95.", "toi co huyet ap 150/95.", "Khách hàng Tối bị HIV."])(
    "does not mask a real personal or named health subject: %s", (answer) => {
      expect(validateKnowledgeEntryPrivacy({ question: "Tập luyện là gì?", answer }).valid).toBe(false);
    },
  );

  it("accepts the bibliographic phrase An Umbrella Review in a source title", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "Tập luyện là gì?",
      sources: [{ title: "Training: An Umbrella Review of Meta-analyses", publisher: "Sports Medicine" }],
    })).toEqual({ valid: true });
  });

  it("does not exempt a patient's name merely because its source mentions a review", () => {
    expect(validateKnowledgeEntryPrivacy({
      question: "Tập luyện là gì?",
      sources: [{ title: "An bị tiểu đường: review", publisher: "Synthetic Journal" }],
    }).valid).toBe(false);
  });
});
