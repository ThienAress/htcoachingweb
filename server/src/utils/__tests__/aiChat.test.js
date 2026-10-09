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
    expect(
      parseChatRequest({ message: "hello", retryOfMessageId: "not-an-id" }).error,
    ).toContain("retry");
    expect(
      parseChatRequest({
        message: "hello",
        retryOfMessageId: "507f1f77bcf86cd799439012",
      }).error,
    ).toContain("cuộc trò chuyện");
  });

  it("keeps a valid retry target separate from the user message payload", () => {
    const result = parseChatRequest({
      message: "Gửi lại câu hỏi",
      conversationId: "507f1f77bcf86cd799439011",
      retryOfMessageId: "507f1f77bcf86cd799439012",
    });

    expect(result.error).toBeUndefined();
    expect(result.value.retryOfMessageId).toBe("507f1f77bcf86cd799439012");
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

  it("accepts only a complete, bounded calculate_tdee structured action", () => {
    const structuredAction = {
      type: "calculate_tdee",
      payload: {
        gender: "male",
        age: 28,
        heightCm: 175,
        weightKg: 75,
        dailyMovement: "mixed",
        steps: "between_5000_7999",
        trainingFrequency: "three_four",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "maintenance",
      },
    };
    const result = parseChatRequest({
      message: "Tính TDEE từ thông tin tôi đã xác nhận",
      structuredAction,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.structuredAction).toEqual(structuredAction);
  });

  it("rejects incomplete, contradictory, unknown or over-posted structured actions", () => {
    const basePayload = {
      gender: "male",
      age: 28,
      heightCm: 175,
      weightKg: 75,
      dailyMovement: "mixed",
      steps: "between_5000_7999",
      trainingFrequency: "three_four",
      trainingDuration: "between_45_60",
      trainingIntensity: "moderate",
      goal: "maintenance",
    };
    const parseAction = (structuredAction) =>
      parseChatRequest({ message: "Tính TDEE", structuredAction });

    expect(
      parseAction({
        type: "calculate_tdee",
        payload: { ...basePayload, weightKg: undefined },
      }).error,
    ).toMatch(/TDEE/i);
    expect(
      parseAction({
        type: "calculate_tdee",
        payload: {
          ...basePayload,
          trainingFrequency: "none",
          trainingDuration: "over_60",
        },
      }).error,
    ).toMatch(/TDEE/i);
    expect(
      parseAction({ type: "cancel_booking", payload: basePayload }).error,
    ).toMatch(/không (?:được )?hỗ trợ/i);
    expect(
      parseAction({
        type: "calculate_tdee",
        payload: { ...basePayload, admin: true },
      }).error,
    ).toMatch(/TDEE/i);
  });
});
