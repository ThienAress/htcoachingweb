import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NETLIFY_BUILD_BATCH_WINDOW_MS,
  scheduleNetlifyBuild,
  triggerNetlifyBuild,
} from "../triggerBuild.js";

const originalBuildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalBuildHookUrl === undefined) {
    delete process.env.NETLIFY_BUILD_HOOK_URL;
  } else {
    process.env.NETLIFY_BUILD_HOOK_URL = originalBuildHookUrl;
  }
});

describe("scheduleNetlifyBuild", () => {
  it("coalesces content changes into one build after 15 minutes", async () => {
    vi.useFakeTimers();
    process.env.NETLIFY_BUILD_HOOK_URL =
      "https://api.netlify.com/build_hooks/test";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    expect(scheduleNetlifyBuild("blog_published")).toEqual({
      scheduled: true,
      coalesced: false,
      delayMs: 15 * 60 * 1000,
    });
    expect(scheduleNetlifyBuild("blog_updated")).toEqual({
      scheduled: true,
      coalesced: true,
      delayMs: 15 * 60 * 1000,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(NETLIFY_BUILD_BATCH_WINDOW_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not create a timer when the hook is not configured", () => {
    vi.useFakeTimers();
    delete process.env.NETLIFY_BUILD_HOOK_URL;

    expect(scheduleNetlifyBuild("blog_published")).toEqual({
      scheduled: false,
      reason: "not_configured",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a pending batch when another content type builds immediately", async () => {
    vi.useFakeTimers();
    process.env.NETLIFY_BUILD_HOOK_URL =
      "https://api.netlify.com/build_hooks/test";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    scheduleNetlifyBuild("blog_updated");

    await triggerNetlifyBuild();
    await vi.advanceTimersByTimeAsync(NETLIFY_BUILD_BATCH_WINDOW_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("triggerNetlifyBuild", () => {
  it("skips safely when the production hook is not configured", async () => {
    delete process.env.NETLIFY_BUILD_HOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(triggerNetlifyBuild()).resolves.toEqual({
      triggered: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a successful content rebuild request", async () => {
    process.env.NETLIFY_BUILD_HOOK_URL =
      "https://api.netlify.com/build_hooks/test";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(triggerNetlifyBuild()).resolves.toEqual({
      triggered: true,
      status: 201,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      process.env.NETLIFY_BUILD_HOOK_URL,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not create an unhandled rejection when Netlify rejects the hook", async () => {
    process.env.NETLIFY_BUILD_HOOK_URL =
      "https://api.netlify.com/build_hooks/test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(triggerNetlifyBuild()).resolves.toEqual({
      triggered: false,
      reason: "request_failed",
    });
  });
});
