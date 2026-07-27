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
});
