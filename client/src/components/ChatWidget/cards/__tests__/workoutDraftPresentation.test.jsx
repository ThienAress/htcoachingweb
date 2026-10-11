import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../../ChatBubble";
import { buildBoundedWorkoutDraft } from "../../../../../../server/src/services/ai/workoutDraft.js";

describe("workout draft presentation", () => {
  it("renders sessions, individual exercises and safety sections through the chat Markdown renderer", () => {
    const content = buildBoundedWorkoutDraft(
      "Tạo lịch tập 4 ngày/tuần cho người mới, chỉ có tạ đơn và dây kháng lực, tối đa 60 phút, kèm deload.",
    );
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ChatBubble message={{ role: "assistant", content }} />
      </MemoryRouter>,
    );

    expect(html.match(/<h3[^>]*>Buổi /g)).toHaveLength(4);
    expect(html.match(/<li[\s>]/g)).toHaveLength(16);
    expect(html).toMatch(/<h3[^>]*>Tiến độ<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>Giảm tải<\/h3>/);
    expect(html).toMatch(/<p[^>]*>Dừng bài nếu đau nhói/);
  });
});
