import { describe, expect, it } from "vitest";

import {
  buildConversationQuestionItems,
  shouldShowConversationNavigator,
} from "../conversationNavigatorRuntime.js";

describe("conversation navigator", () => {
  it("chỉ lập mục điều hướng từ câu hỏi của người dùng", () => {
    expect(
      buildConversationQuestionItems([
        { _id: "u1", role: "user", content: "  Tôi nên ăn bao nhiêu protein?  " },
        { _id: "a1", role: "assistant", content: "Bạn có thể bắt đầu từ..." },
        { localId: "u2", role: "user", content: "\nGợi ý meal plan cho ngày tập nặng\n" },
      ]),
    ).toEqual([
      { key: "u1", messageIndex: 0, label: "Tôi nên ăn bao nhiêu protein?" },
      { key: "u2", messageIndex: 2, label: "Gợi ý meal plan cho ngày tập nặng" },
    ]);
  });

  it("rút gọn câu hỏi dài để popover không lấn vùng chat", () => {
    const [item] = buildConversationQuestionItems([
      {
        localId: "long-question",
        role: "user",
        content: "Tôi muốn một thực đơn chi tiết cho cả tuần, phù hợp lịch tập năm buổi và mục tiêu giảm mỡ nhưng vẫn giữ cơ bắp",
      },
    ]);

    expect(item.label).toBe(
      "Tôi muốn một thực đơn chi tiết cho cả tuần, phù hợp lịch tập…",
    );
  });

  it("chỉ hiện navigator khi chat bị tràn và có từ hai câu hỏi", () => {
    expect([
      shouldShowConversationNavigator({
        clientHeight: 700,
        scrollHeight: 1200,
        questionCount: 2,
      }),
      shouldShowConversationNavigator({
        clientHeight: 700,
        scrollHeight: 700,
        questionCount: 4,
      }),
      shouldShowConversationNavigator({
        clientHeight: 700,
        scrollHeight: 1200,
        questionCount: 1,
      }),
    ]).toEqual([true, false, false]);
  });
});
