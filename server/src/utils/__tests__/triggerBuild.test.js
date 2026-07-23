import { afterEach, describe, expect, it, vi } from "vitest";

import { triggerNetlifyBuild } from "../triggerBuild.js";

const originalBuildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBuildHookUrl === undefined) {
    delete process.env.NETLIFY_BUILD_HOOK_URL;
  } else {
    process.env.NETLIFY_BUILD_HOOK_URL = originalBuildHookUrl;
  }
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
