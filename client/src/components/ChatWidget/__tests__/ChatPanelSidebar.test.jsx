import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "AC009", role: "user" } }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import ChatPanelSidebar from "../ChatPanelSidebar";

describe("ChatPanelSidebar conversation targeting", () => {
  it("exposes an exact keyboard-focusable name for each conversation row", () => {
    const html = renderToStaticMarkup(
      <ChatPanelSidebar
        conversations={[{
          _id: "conversation-b",
          title: "Câu hỏi B",
          updatedAt: "2026-09-15T18:44:48.000Z",
        }]}
        activeId="conversation-a"
        pendingConversationIds={["conversation-b"]}
        onNew={vi.fn()}
        onSwitch={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onOpenMemory={vi.fn()}
      />,
    );

    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Mở cuộc trò chuyện: Câu hỏi B"/,
    );
  });
});
