import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("js-cookie", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn() },
}));

import Cookies from "js-cookie";
import api from "../../utils/api";
import { openAiChatStream } from "../ai.service.js";

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
});
