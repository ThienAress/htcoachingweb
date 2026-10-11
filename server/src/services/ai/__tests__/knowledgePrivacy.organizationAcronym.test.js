import { describe, expect, it } from "vitest";
import { prepareExternalKnowledgeQuery } from "../knowledgePrivacy.js";

describe("Knowledge privacy: public health organization acronyms", () => {
  it.each([
    "Theo WHO, người trưởng thành nên vận động bao nhiêu phút mỗi tuần? Hãy kèm nguồn công khai.",
    "Theo CDC, người lớn nên ngủ bao nhiêu giờ mỗi đêm? Kèm nguồn.",
    "Theo ACSM, người mới nên tập sức mạnh mấy buổi mỗi tuần?",
    "Theo NIH, chế độ ăn nào hỗ trợ giảm mỡ? Hãy dẫn nguồn.",
  ])("keeps an organization-attributed question eligible for web lookup: %s", (question) => {
    const prepared = prepareExternalKnowledgeQuery(question, { allowedPublicPersonNames: [] });
    expect(prepared.eligible).toBe(true);
    expect(prepared.query).toContain(question.split(",")[0]);
  });

  it.each([
    "Theo Nguyen Van An, tôi nên tập gì?",
    "Bạn tôi tên Theo Nguyen bị tiểu đường, anh ấy nên ăn gì?",
    "Theo Tran Minh Quan hỏi về ngưỡng WHO cho người lớn",
  ])("still blocks a private person name next to an organization: %s", (question) => {
    const prepared = prepareExternalKnowledgeQuery(question, { allowedPublicPersonNames: [] });
    expect(prepared.eligible).toBe(false);
  });
});
