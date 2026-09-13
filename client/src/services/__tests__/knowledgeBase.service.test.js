import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from "../../utils/api";
import {
  getAllConversations,
  getFullConversation,
  getKBVariants,
  reviewAiFeedback,
  searchKB,
} from "../knowledgeBase.service";

describe("knowledgeBase service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    api.post.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it("sends the feedback review filters to the admin conversation queue", async () => {
    const params = {
      page: 1,
      limit: 15,
      feedback: "down",
      feedbackReviewStatus: "pending",
    };

    await getAllConversations(params, "signal");

    expect(api.get).toHaveBeenCalledWith("/knowledge-base/conversations", {
      params,
      signal: "signal",
    });
  });

  it("reviews one assistant message through the admin endpoint", async () => {
    await reviewAiFeedback("conversation-1", "message-1", "resolved");

    expect(api.post).toHaveBeenCalledWith(
      "/knowledge-base/feedback/conversation-1/message-1/review",
      { status: "resolved" },
    );
  });

  it("sends exact feedback filters when loading an admin conversation detail", async () => {
    const params = {
      feedback: "down",
      feedbackReviewStatus: "pending",
    };

    await getFullConversation("conversation-1", params, "signal");

    expect(api.get).toHaveBeenCalledWith(
      "/knowledge-base/conversations/conversation-1",
      { params, signal: "signal" },
    );
  });

  it("forwards an abort signal to Knowledge Base search", async () => {
    const params = { q: "deadlift", limit: 3, threshold: 0.75 };

    await searchKB(params, "signal");

    expect(api.get).toHaveBeenCalledWith("/knowledge-base/search", {
      params,
      signal: "signal",
    });
  });

  it("forwards an abort signal when loading entry variants", async () => {
    await getKBVariants("entry-1", "signal");

    expect(api.get).toHaveBeenCalledWith(
      "/knowledge-base/entry-1/variants",
      { signal: "signal" },
    );
  });
});
