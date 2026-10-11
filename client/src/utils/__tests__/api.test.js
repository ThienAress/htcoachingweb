import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("js-cookie", () => ({
  default: {
    get: vi.fn(() => "stale-csrf-token"),
    set: vi.fn(),
  },
}));

import Cookies from "js-cookie";
import api from "../api.js";

const originalAdapter = api.defaults.adapter;

const response = (config, status, data = {}) => ({
  status,
  statusText: status === 200 ? "OK" : "No Content",
  headers: status === 204 ? { "x-csrf-token": "mock-rotated-csrf-token" } : {},
  config,
  data,
});

const unauthorized = (config) => new AxiosError(
  "Unauthorized",
  "ERR_BAD_REQUEST",
  config,
  null,
  { status: 401, statusText: "Unauthorized", headers: {}, config, data: {} },
);

beforeEach(() => {
  vi.clearAllMocks();
  Cookies.get.mockReturnValue("stale-csrf-token");
  Cookies.set.mockImplementation(() => {});
  vi.stubGlobal("window", {
    location: { origin: "http://localhost:3000", href: "http://localhost:3000/exercises" },
  });
  api.defaults.adapter = originalAdapter;
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});

describe("auth refresh interceptor", () => {
  it.each([
    "/auth/refresh?source=session",
    "/auth/refresh/",
    "http://localhost:5000/api/auth/refresh/",
    "/auth/logout?source=menu",
    "/auth/logout/",
    "http://localhost:5000/api/auth/logout/",
  ])("never refreshes a rejected auth endpoint %s recursively", async (url) => {
    const adapter = vi.fn(async (config) => { throw unauthorized(config); });
    api.defaults.adapter = adapter;

    await expect(api.post(url)).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("http://localhost:3000/exercises");
  });

  it.each([403, "network"])("does not refresh an initial session error %s", async (failure) => {
    const adapter = vi.fn(async (config) => {
      if (failure === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, null, response(config, 403));
    });
    api.defaults.adapter = adapter;

    await expect(api.get("/user/me")).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("http://localhost:3000/exercises");
  });

  it.each(["/user/me", "/user/me?session=check", "http://localhost:5000/api/user/me/"])(
    "keeps anonymous visitors on their page when session refresh fails for %s",
    async (url) => {
      const adapter = vi.fn(async (config) => { throw unauthorized(config); });
      api.defaults.adapter = adapter;

      await expect(api.get(url)).rejects.toMatchObject({ response: { status: 401 } });

      expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([url, "/auth/refresh"]);
      expect(window.location.href).toBe("http://localhost:3000/exercises");
    },
  );

  it("still redirects a protected request when refresh fails", async () => {
    api.defaults.adapter = async (config) => { throw unauthorized(config); };

    await expect(api.get("/contracts")).rejects.toMatchObject({ response: { status: 401 } });

    expect(window.location.href).toBe("/login");
  });

  it.each([403, "network"])("keeps a failed session check local on refresh %s", async (failure) => {
    api.defaults.adapter = async (config) => {
      if (config.url !== "/auth/refresh") throw unauthorized(config);
      if (failure === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, null, response(config, 403));
    };

    await expect(api.get("/user/me")).rejects.toMatchObject(
      failure === "network" ? { code: "ERR_NETWORK" } : { response: { status: 403 } },
    );
    expect(window.location.href).toBe("http://localhost:3000/exercises");
  });

  it.each([
    ["/user/me", "/user/me", "http://localhost:3000/exercises"],
    ["/user/me", "/contracts", "/login"],
    ["/contracts", "/user/me", "/login"],
  ].flatMap((row) => [401, 403, "network"].map((failure) => [...row, failure])))(
    "settles concurrent failures for %s then %s to %s on refresh %s", async (first, second, target, failure) => {
    let releaseRefresh;
    const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
    let refreshRequests = 0;
    let resourceRequests = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshRequests += 1;
        await refreshGate;
        if (failure === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
        throw new AxiosError("Refresh failed", "ERR_BAD_REQUEST", config, null, response(config, failure));
      } else {
        resourceRequests += 1;
      }
      throw unauthorized(config);
    };

    const firstRequest = api.get(first);
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    const requests = Promise.allSettled([firstRequest, api.get(second)]);
    await vi.waitFor(() => expect(resourceRequests).toBe(2));
    releaseRefresh();
    const results = await requests;

    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(refreshRequests).toBe(1);
    expect(window.location.href).toBe(target);

    await expect(api.get("/user/me")).rejects.toMatchObject(
      failure === "network" ? { code: "ERR_NETWORK" } : { response: { status: failure } },
    );
    expect(refreshRequests).toBe(2);
  });

  it("uses the rotated CSRF cookie on a retried mutation", async () => {
    let cookie = "stale-csrf-token";
    Cookies.get.mockImplementation(() => cookie);
    Cookies.set.mockImplementation((name, value) => { if (name === "csrfToken") cookie = value; });
    const mutationTokens = [];
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") return response(config, 204);
      mutationTokens.push(config.headers.get("X-CSRF-Token"));
      if (mutationTokens.length === 1) throw unauthorized(config);
      return response(config, 200);
    };

    await api.post("/contracts", {});
    expect(mutationTokens).toEqual(["stale-csrf-token", "mock-rotated-csrf-token"]);
  });

  it("settles both concurrent retries without a second refresh if they remain unauthorized", async () => {
    let refreshRequests = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshRequests += 1;
        return response(config, 204);
      }
      throw unauthorized(config);
    };

    const results = await Promise.allSettled([api.get("/user/me"), api.get("/contracts")]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(refreshRequests).toBe(1);
  });

  it("refreshes an expired /user/me request and retries the session check", async () => {
    let meAttempts = 0;
    const adapter = vi.fn(async (config) => {
      if (config.url === "/user/me" && meAttempts++ === 0) {
        throw unauthorized(config);
      }
      if (config.url === "/auth/refresh") return response(config, 204);
      return response(config, 200, { email: "user@example.com" });
    });
    api.defaults.adapter = adapter;

    const result = await api.get("/user/me");

    expect(result.data.email).toBe("user@example.com");
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      "/user/me",
      "/auth/refresh",
      "/user/me",
    ]);
    expect(Cookies.set).toHaveBeenCalledWith(
      "csrfToken",
      "mock-rotated-csrf-token",
      { path: "/" },
    );
  });

  it("shares one refresh across concurrent expired session checks", async () => {
    let initialMeRequests = 0;
    let refreshRequests = 0;
    const adapter = vi.fn(async (config) => {
      if (config.url === "/user/me" && initialMeRequests++ < 2) {
        throw unauthorized(config);
      }
      if (config.url === "/auth/refresh") {
        refreshRequests += 1;
        return response(config, 204);
      }
      return response(config, 200, { email: "user@example.com" });
    });
    api.defaults.adapter = adapter;

    const results = await Promise.all([api.get("/user/me"), api.get("/user/me")]);

    expect(results).toHaveLength(2);
    expect(refreshRequests).toBe(1);
    expect(initialMeRequests).toBe(4);
  });

  it("does not refresh a request twice when the retried request is still unauthorized", async () => {
    let refreshRequests = 0;
    const adapter = vi.fn(async (config) => {
      if (config.url === "/auth/refresh") {
        refreshRequests += 1;
        return response(config, 204);
      }
      throw unauthorized(config);
    });
    api.defaults.adapter = adapter;

    await expect(api.get("/user/me")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshRequests).toBe(1);
  });
});
