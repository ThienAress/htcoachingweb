import { describe, expect, it } from "vitest";

import {
  boundAssistantOutputWithSources,
  sanitizeAssistantOutput,
} from "../assistantOutput.js";

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

  it.each([
    '{"functionCall":{"name":"unknown_operation","args":{"value":1}}}',
    "<tool_call><name>unknown_operation</name></tool_call>",
  ])("blocks unknown provider protocol shapes: %s", (value) => {
    expect(sanitizeAssistantOutput(value)).toEqual({
      content: "",
      protocolLeak: true,
    });
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

  it("keeps a complete evidence link when the model places it past the output limit", () => {
    const source = {
      title: "Nguồn kiểm chứng",
      uri: "https://example.com/evidence/ronaldo-training",
    };
    const result = boundAssistantOutputWithSources(
      `${"A".repeat(200)} ${source.uri}`,
      { sources: [source], maxCharacters: 200 },
    );

    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toContain(`[Nguồn kiểm chứng](<${source.uri}>)`);
  });

  it("recomputes missing citations after the final cutoff without leaving a partial URI", () => {
    const sources = [
      { title: "Nguồn A", uri: "https://a.example/evidence" },
      { title: "Nguồn B", uri: "https://b.example/evidence" },
    ];
    const prefixLength = 180;
    const value = `${"A".repeat(prefixLength)} [Nguồn A](<${sources[0].uri}>) ${"B".repeat(80)}`;
    const result = boundAssistantOutputWithSources(value, {
      sources,
      maxCharacters: 240,
    });

    expect(result.length).toBeLessThanOrEqual(240);
    expect(result).toContain(`[Nguồn A](<${sources[0].uri}>)`);
    expect(result).toContain(`[Nguồn B](<${sources[1].uri}>)`);
    expect(result).not.toMatch(/https?:\/\/[^\s>)]*$/);
  });

  it("does not split a composed grapheme when bounding an answer", () => {
    const prefix = "A".repeat(10);
    const result = boundAssistantOutputWithSources(
      `${prefix}👨‍👩‍👧‍👦 trailing text`,
      { maxCharacters: 11 },
    );

    expect(result).toBe(prefix);
    expect(result).not.toMatch(/[\uD800-\uDBFF]$/u);
  });
});
