import { describe, expect, it } from "vitest";

import { sanitizeAssistantOutput } from "../assistantOutput.js";

describe("AI assistant output guard", () => {
  it("removes tool narration while preserving the actual answer", () => {
    const result = sanitizeAssistantOutput(
      "Để trả lời chính xác, mình cần kiểm tra thông tin từ hệ thống nhé!\n\n" +
        "_Đang gọi tool search_knowledge cho từ khóa CBum..._\n\n" +
        "Chris Bumstead là vận động viên Classic Physique người Canada.",
    );

    expect(result).toEqual({
      content: "Chris Bumstead là vận động viên Classic Physique người Canada.",
      protocolLeak: false,
    });
  });

  it("blocks a pseudo tool action instead of exposing internal protocol", () => {
    const result = sanitizeAssistantOutput(
      'Bạn đợi mình một chút!\n\n{ "action": "search_knowledge", "action_input": "vận động viên Việt Nam" }',
    );

    expect(result).toEqual({ content: "", protocolLeak: true });
  });

  it("removes explanations that expose internal tool mechanics", () => {
    const result = sanitizeAssistantOutput(
      'Cảm ơn bạn đã khen! Mình được trang bị các công cụ (tools) để kết nối với dữ liệu thực tế.\n\n' +
        'Khi bạn hỏi về vận động viên, mình sẽ gọi tool search_knowledge để tra cứu thông tin.\n\n' +
        'Khi cần thông tin cập nhật, mình sẽ kiểm chứng từ nguồn phù hợp rồi tổng hợp lại dễ hiểu cho bạn.',
    );

    expect(result).toEqual({
      content:
        'Khi cần thông tin cập nhật, mình sẽ kiểm chứng từ nguồn phù hợp rồi tổng hợp lại dễ hiểu cho bạn.',
      protocolLeak: false,
    });
  });

  it("keeps normal references to customer-facing tools", () => {
    const result = sanitizeAssistantOutput(
      "Bạn có thể dùng công cụ tính TDEE miễn phí trên HTCOACHING.",
    );

    expect(result.content).toBe(
      "Bạn có thể dùng công cụ tính TDEE miễn phí trên HTCOACHING.",
    );
  });
});
