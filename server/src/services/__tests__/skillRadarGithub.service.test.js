import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeGithubRepositoryUrl,
  createSkillRadarGithubService,
} from "../skillRadarGithub.service.js";

describe("skillRadarGithub.service", () => {
  it("canonicalizes query/hash and .git from GitHub URL", () => {
    expect(canonicalizeGithubRepositoryUrl("https://github.com/TencentCloud/TencentDB-Agent-Memory.git?fbclid=x#readme"))
      .toEqual({
        owner: "TencentCloud",
        repo: "TencentDB-Agent-Memory",
        sourceKey: "tencentcloud/tencentdb-agent-memory",
        sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
        repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
      });
  });

  it("rejects non-GitHub and nested URLs", () => {
    expect(() => canonicalizeGithubRepositoryUrl("https://example.com/a/b")).toThrow();
    expect(() => canonicalizeGithubRepositoryUrl("https://github.com/a/b/issues")).toThrow();
  });

  it("creates a safe deterministic TencentDB preview", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: "TencentDB-Agent-Memory",
        full_name: "TencentCloud/TencentDB-Agent-Memory",
        description: "Agent memory\nfor databases",
        topics: ["agent-memory", "rag"],
        license: { spdx_id: "Apache-2.0" },
        pushed_at: "2026-08-11T10:00:00.000Z",
        archived: false,
        secret: "must-not-leak",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("Long-term memory for AI agents", { status: 200 }));

    const preview = await createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/TencentCloud/TencentDB-Agent-Memory?fbclid=x",
      new Date("2026-08-12T02:00:00.000Z"),
    );

    expect(preview).toEqual(expect.objectContaining({
      sourceType: "repository",
      domain: "AI Memory",
      localTargets: ["$ai-chat-system", "AI Memory architecture"],
      nextCheckAt: "2026-09-11T02:00:00.000Z",
    }));
    expect(preview).not.toHaveProperty("secret");
    expect(JSON.stringify(preview)).not.toContain("Long-term memory for AI agents");
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^https:\/\/api\.github\.com\/repos\//);
    expect(fetchImpl.mock.calls[1][0]).toMatch(/\/readme$/);
    expect(fetchImpl.mock.calls.every(([, options]) => options.redirect === "error")).toBe(true);
  });

  it("only sends the dedicated Radar token to GitHub", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: "repo",
        full_name: "example/repo",
        pushed_at: "2026-08-11T10:00:00.000Z",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("README", { status: 200 }));

    await createSkillRadarGithubService({ fetchImpl, token: "radar-read-token" }).analyze(
      "https://github.com/example/repo",
    );

    expect(fetchImpl.mock.calls.every(([, options]) => (
      options.headers.Authorization === "Bearer radar-read-token"
    ))).toBe(true);
  });

  it("uses a bounded README signal to identify an Agent Skill repository", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: "workflow-kit",
        full_name: "example/workflow-kit",
        description: "Reusable agent workflows",
        topics: [],
        license: { spdx_id: "MIT" },
        pushed_at: "2026-08-11T10:00:00.000Z",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("Install the included SKILL.md", { status: 200 }));

    const preview = await createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/example/workflow-kit",
      new Date("2026-08-12T02:00:00.000Z"),
    );

    expect(preview.sourceType).toBe("skill");
  });

  it("maps rate limit headers to retryAt", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("limited", {
      status: 429,
      headers: { "retry-after": "120" },
    }));

    await expect(createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/example/repo",
      new Date("2026-08-12T02:00:00.000Z"),
    )).rejects.toEqual(expect.objectContaining({
      code: "SKILL_RADAR_GITHUB_RATE_LIMITED",
      status: 429,
      retryAt: "2026-08-12T02:02:00.000Z",
    }));
  });

  it("maps a README rate limit to the same retry contract", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: "repo",
        full_name: "example/repo",
        pushed_at: "2026-08-11T10:00:00.000Z",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("limited", {
        status: 403,
        headers: { "retry-after": "60" },
      }));

    await expect(createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/example/repo",
      new Date("2026-08-12T02:00:00.000Z"),
    )).rejects.toEqual(expect.objectContaining({
      code: "SKILL_RADAR_GITHUB_RATE_LIMITED",
      retryAt: "2026-08-12T02:01:00.000Z",
    }));
  });

  it("rejects oversized upstream data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "content-length": String(400 * 1024) },
    }));
    await expect(createSkillRadarGithubService({ fetchImpl }).analyze("https://github.com/example/repo"))
      .rejects.toEqual(expect.objectContaining({ code: "UPSTREAM_TOO_LARGE" }));
  });

  it("rejects upstream redirects instead of following them", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private" },
    }));

    await expect(createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/example/repo",
    )).rejects.toEqual(expect.objectContaining({
      code: "GITHUB_UNAVAILABLE",
      status: 502,
    }));
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
  });

  it("does not leak provider error bodies or URLs in API-facing errors", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error(
      "connect failed https://api.github.com/repos/example/repo?token=secret",
    ));

    await expect(createSkillRadarGithubService({ fetchImpl }).analyze(
      "https://github.com/example/repo",
    )).rejects.toEqual(expect.objectContaining({
      code: "GITHUB_UNAVAILABLE",
      status: 503,
      message: "Không thể đọc GitHub repository",
    }));
  });
});
