import { describe, expect, it } from "vitest";

import { addSkillRadarItemToCache } from "../../../../queries/skillRadar.queries.js";
import {
  buildCreatedRadarItem,
  formToCreatePayload,
  getSkillRadarMutationError,
  previewToForm,
  validateGitHubRepoUrl,
  validateSkillRadarSourceForm,
} from "../skillRadarSourceForm.utils.js";

describe("skill radar source form", () => {
  const preview = {
    repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
    sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
    sourceType: "repository",
    domain: "AI Memory",
    summary: "Bộ nhớ dài hạn cho agent",
    localTargets: ["$ai-chat-system", "AI Memory architecture"],
    lifecycle: "candidate",
    trustTier: "community",
    license: "Apache-2.0",
    lastUpstreamCommitAt: "2026-08-10T00:00:00.000Z",
    lastCheckedAt: "2026-08-12T00:00:00.000Z",
    nextCheckAt: "2026-09-11T00:00:00.000Z",
    repositoryArchived: false,
    skillsShUrl: null,
  };

  it("accepts a GitHub repository URL with tracking params and rejects unsafe shapes", () => {
    expect(validateGitHubRepoUrl("https://github.com/TencentCloud/TencentDB-Agent-Memory?fbclid=test")).toBe("");
    expect(validateGitHubRepoUrl("http://github.com/TencentCloud/TencentDB-Agent-Memory")).toContain("https://github.com");
    expect(validateGitHubRepoUrl("https://example.com/TencentCloud/TencentDB-Agent-Memory")).toContain("https://github.com");
    expect(validateGitHubRepoUrl("https://github.com/TencentCloud/TencentDB-Agent-Memory/issues")).toContain("https://github.com");
  });

  it("maps preview fields into an editable, allowlisted create payload", () => {
    const form = previewToForm(preview);
    const payload = formToCreatePayload({ ...form, localTargets: "$ai-chat-system, AI Memory architecture, " }, preview);

    expect(form.name).toBe("TencentDB-Agent-Memory");
    expect(payload).toEqual(expect.objectContaining({
      sourceUrl: preview.repoUrl,
      sourceType: "repository",
      name: "TencentDB-Agent-Memory",
      domain: "AI Memory",
      localTargets: ["$ai-chat-system", "AI Memory architecture"],
      lifecycle: "candidate",
    }));
    expect(Object.keys(payload).sort()).toEqual([
      "domain",
      "lifecycle",
      "localTargets",
      "name",
      "sourceType",
      "sourceUrl",
      "summary",
    ]);
    expect(payload).not.toHaveProperty("rawReadme");
  });

  it("gives actionable duplicate and rate-limit feedback", () => {
    expect(getSkillRadarMutationError({ response: { status: 409 } }, "fallback").message).toContain("đã có");
    expect(getSkillRadarMutationError({
      response: { status: 429, data: { retryAt: "2026-08-12T13:00:00.000Z" } },
    }, "fallback")).toEqual(expect.objectContaining({
      message: expect.stringContaining("vẫn được giữ nguyên"),
      retryAt: "2026-08-12T13:00:00.000Z",
    }));
  });

  it("rejects local targets that exceed the server contract", () => {
    const form = previewToForm(preview);
    expect(validateSkillRadarSourceForm({
      ...form,
      localTargets: Array.from({ length: 13 }, (_, index) => `target-${index}`).join(", "),
    })).toContain("1–12");
    expect(validateSkillRadarSourceForm({
      ...form,
      localTargets: "x".repeat(121),
    })).toContain("120");
  });

  it("builds a complete cache row when create API only returns id and canonical URL", () => {
    const form = previewToForm(preview);
    const item = buildCreatedRadarItem({
      id: "tencentcloud/tencentdb-agent-memory",
      repoUrl: preview.repoUrl,
    }, preview, form);

    expect(item).toEqual(expect.objectContaining({
      id: "tencentcloud/tencentdb-agent-memory",
      name: "TencentDB-Agent-Memory",
      sourceRepo: preview.sourceRepo,
      drift: "review_due",
      decision: "pending",
      auditSummary: [],
    }));
  });

  it("inserts the saved source into cache immediately and recomputes summary", () => {
    const current = {
      items: [{ id: "existing", lifecycle: "active", drift: "clean" }],
      summary: {
        total: 1,
        active: 1,
        changed: 0,
        reviewDue: 0,
        candidates: 0,
        dormant: 0,
        rateLimited: 0,
        unreachable: 1,
      },
      schedule: { nextRunAt: "2026-09-01T02:00:00.000Z" },
    };
    const item = { id: "dynamic", lifecycle: "candidate", drift: "review_due" };

    const updated = addSkillRadarItemToCache(current, { item });

    expect(updated.items).toEqual([item, current.items[0]]);
    expect(updated.summary).toEqual(expect.objectContaining({ total: 2, active: 1, candidates: 1, reviewDue: 1 }));
    expect(updated.schedule).toBe(current.schedule);
    expect(current.items).toHaveLength(1);
  });
});
