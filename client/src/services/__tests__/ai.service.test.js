import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("js-cookie", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("../../utils/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import Cookies from "js-cookie";
import api from "../../utils/api";
import {
  clearAiMemory,
  deleteAiMemoryKind,
  getAiMemory,
  getAiMemoryExport,
  openAiChatStream,
  replaceAiMealItem,
  setAiMemoryConsent,
  upsertAiMemory,
} from "../ai.service.js";

describe("openAiChatStream", () => {
  let csrfToken;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    csrfToken = "stale-token";
    Cookies.get.mockImplementation(() => csrfToken);
    Cookies.set.mockImplementation((_name, value) => {
      csrfToken = value;
    });
  });

  it("recovers once from an invalid CSRF token using the server header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: "Invalid CSRF token" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": "fresh-token",
          },
        },
      ))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await openAiChatStream({ message: "Xin chào" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBe("fresh-token");
  });

  it("refreshes an expired session and retries with the rotated CSRF token", async () => {
    const payload = {
      message: "Xin chào",
      conversationId: "conversation-1",
      requestId: "request-1",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    api.post.mockImplementation(async () => {
      csrfToken = "rotated-token";
    });

    const response = await openAiChatStream(payload);

    expect(response.status).toBe(200);
    expect(api.post).toHaveBeenCalledWith("/auth/refresh", {});
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBe("rotated-token");
    expect(fetchMock.mock.calls.map(([, options]) => options.body)).toEqual([
      JSON.stringify(payload),
      JSON.stringify(payload),
    ]);
  });

  it("preserves the same request body after refresh so conversation retry is idempotent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    api.post.mockResolvedValue({ data: {} });
    const payload = {
      message: "Lịch tập cho tôi",
      conversationId: "conversation-1",
      requestId: "a26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
    };

    await openAiChatStream(payload);

    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(payload));
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify(payload));
  });

  it("uses owner-scoped AI memory routes with bounded payloads", async () => {
    api.get.mockResolvedValue({ data: { success: true, data: {} } });
    api.put.mockResolvedValue({ data: { success: true, data: {} } });
    api.delete.mockResolvedValue({ data: { success: true, data: {} } });

    await getAiMemory();
    await getAiMemoryExport();
    await setAiMemoryConsent(true);
    await upsertAiMemory("response_style", "concise");
    await deleteAiMemoryKind("response_style");
    await clearAiMemory();

    expect(api.get).toHaveBeenNthCalledWith(1, "/ai/memory");
    expect(api.get).toHaveBeenNthCalledWith(2, "/ai/memory/export");
    expect(api.put).toHaveBeenNthCalledWith(1, "/ai/memory/consent", {
      enabled: true,
    });
    expect(api.put).toHaveBeenNthCalledWith(2, "/ai/memory/response_style", {
      value: "concise",
    });
    expect(api.delete).toHaveBeenNthCalledWith(1, "/ai/memory/response_style");
    expect(api.delete).toHaveBeenNthCalledWith(2, "/ai/memory");
  });

  it("replaces one meal item through the owner-scoped deterministic endpoint", async () => {
    api.post.mockResolvedValue({
      data: { success: true, data: { card: { cardType: "meal" } } },
    });

    const result = await replaceAiMealItem("conversation-1", {
      operationId: "22222222-2222-4222-8222-222222222222",
      mealPlanId: "11111111-1111-4111-8111-111111111111",
      expectedRevision: 3,
      mealIndex: 1,
      foodIndex: 2,
    });

    expect(api.post).toHaveBeenCalledWith(
      "/ai/conversations/conversation-1/meal-replacements",
      {
        operationId: "22222222-2222-4222-8222-222222222222",
        mealPlanId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: 3,
        mealIndex: 1,
        foodIndex: 2,
      },
    );
    expect(result).toMatchObject({ success: true });
  });

  it("retries an uncertain meal replacement once with the same operation id", async () => {
    const uncertainError = Object.assign(new Error("Network Error"), {
      code: "ERR_NETWORK",
    });
    api.post
      .mockRejectedValueOnce(uncertainError)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: { card: { cardType: "meal", data: { mealRevision: 2 } } },
        },
      });
    const payload = {
      operationId: "33333333-3333-4333-8333-333333333333",
      mealPlanId: "11111111-1111-4111-8111-111111111111",
      expectedRevision: 1,
      mealIndex: 0,
      foodIndex: 1,
    };

    const result = await replaceAiMealItem("conversation-1", payload);

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls.map(([, body]) => body)).toEqual([
      payload,
      payload,
    ]);
    expect(result).toMatchObject({ success: true });
  });
});
