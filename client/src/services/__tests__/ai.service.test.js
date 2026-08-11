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
  setAiMemoryConsent,
  upsertAiMemory,
} from "../ai.service.js";

describe("openAiChatStream", () => {
  let csrfToken;

  beforeEach(() => {
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    api.post.mockImplementation(async () => {
      csrfToken = "rotated-token";
    });

    const response = await openAiChatStream({ message: "Xin chào" });

    expect(response.status).toBe(200);
    expect(api.post).toHaveBeenCalledWith("/auth/refresh", {});
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBe("rotated-token");
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
});
