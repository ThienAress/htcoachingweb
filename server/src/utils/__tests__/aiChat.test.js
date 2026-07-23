import { describe, expect, it } from "vitest";

import {
  MAX_CHAT_MESSAGE_LENGTH,
  parseChatRequest,
} from "../aiChat.js";

describe("parseChatRequest", () => {
  it("trims bounded input and ignores untrusted context fields", () => {
    const result = parseChatRequest({
      message: "  Xin chào  ",
      requestId: "a26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
      context: {
        page: "/blog/example",
        pageType: "blog",
        admin: true,
        userMetrics: { age: 30, weightKg: 70, secret: "nope" },
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.value.message).toBe("Xin chào");
    expect(result.value.context).toEqual({
      page: "/blog/example",
      pageType: "blog",
      userMetrics: { age: 30, weightKg: 70 },
    });
  });

  it("rejects oversized messages and malformed ids", () => {
    expect(
      parseChatRequest({ message: "x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1) }).error,
    ).toContain("vượt quá");
    expect(
      parseChatRequest({ message: "hello", conversationId: "not-an-id" }).error,
    ).toContain("cuộc trò chuyện");
    expect(
      parseChatRequest({ message: "hello", requestId: "not-a-uuid" }).error,
    ).toContain("yêu cầu chat");
  });

  it("accepts supported small images and rejects oversized images", () => {
    const small = parseChatRequest({
      message: "Xem ảnh",
      context: { image: `data:image/png;base64,${"YQ=="}` },
    });
    const oversized = parseChatRequest({
      message: "Xem ảnh",
      context: {
        image: `data:image/png;base64,${"a".repeat(410000)}`,
      },
    });

    expect(small.error).toBeUndefined();
    expect(oversized.error).toContain("300 KB");
  });
});
