import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import SkillRadarSource from "../../models/SkillRadarSource.js";
import {
  buildSkillRadarReadModel,
  projectTechnologyRadarEntries,
  refreshDueSkillRadarSources,
} from "../skillRadar.service.js";
import { skillRadarGithubService } from "../skillRadarGithub.service.js";

const NOW = new Date("2026-08-12T02:00:00.000Z");

describe("static technology Radar projection", () => {
  it("projects TencentDB as one repository row without turning it into a skill", () => {
    const projected = projectTechnologyRadarEntries({
      schemaVersion: 1,
      entries: [{
        id: "tencentcloud/tencentdb-agent-memory",
        name: "TencentDB Agent Memory",
        sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
        repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
        category: "AI memory architecture",
        summary: "Long-term agent memory",
        ring: "assess",
        decision: "adapt",
        decisionReason: "Keep explicit memory and provenance only.",
        localTargets: ["docs/specs/ai-explicit-memory.md"],
        trustTier: "official",
        license: "MIT",
        reviewedAt: "2026-08-11",
        nextReviewAt: "2026-09-10",
        autoInstall: false,
      }],
    }, new Date("2026-09-04T02:00:00.000Z"));

    expect(projected.entries).toEqual([
      expect.objectContaining({
        id: "tencentcloud/tencentdb-agent-memory",
        sourceType: "repository",
        lifecycle: "watch",
        domain: "AI memory architecture",
      }),
    ]);
    expect(projected.observations).toEqual([
      expect.objectContaining({
        id: "tencentcloud/tencentdb-agent-memory",
        drift: "clean",
        decision: "adapt",
        nextCheckAt: "2026-09-10T02:00:00.000Z",
      }),
    ]);

    const readModel = buildSkillRadarReadModel({
      watchlist: { schemaVersion: 1, entries: projected.entries },
      snapshot: { schemaVersion: 1, items: projected.observations },
      now: new Date("2026-09-04T02:00:00.000Z"),
    });
    expect(readModel.items).toHaveLength(1);
    expect(readModel.items[0].sourceType).toBe("repository");
  });

  it("marks an overdue technology review due and deduplicates repeated ids", () => {
    const entry = {
      id: "example/technology",
      name: "Technology",
      sourceRepo: "example/technology",
      repoUrl: "https://github.com/example/technology",
      category: "AI",
      summary: "Example",
      ring: "assess",
      decision: "defer",
      decisionReason: "Needs more evidence.",
      localTargets: ["docs/specs/example.md"],
      trustTier: "community",
      license: "MIT",
      reviewedAt: "2026-08-01",
      nextReviewAt: "2026-09-01",
      autoInstall: false,
    };
    const projected = projectTechnologyRadarEntries(
      { schemaVersion: 1, entries: [entry, entry] },
      new Date("2026-09-04T02:00:00.000Z"),
    );

    expect(projected.entries).toHaveLength(1);
    expect(projected.observations[0].drift).toBe("review_due");
  });
});

const createDueSource = async ({ id, createdBy }) => SkillRadarSource.create({
  _id: id,
  sourceType: "repository",
  name: id.split("/").at(-1),
  sourceRepo: id,
  repoUrl: `https://github.com/${id}`,
  domain: "Testing",
  summary: "Repository test",
  localTargets: ["$qa"],
  lifecycle: "active",
  reviewIntervalDays: 30,
  nextCheckAt: new Date("2026-08-01T02:00:00.000Z"),
  createdBy,
  auditLogId: createdBy,
});

beforeAll(setupTestDB);
afterEach(async () => {
  vi.restoreAllMocks();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("refreshDueSkillRadarSources", () => {
  it("keeps a repository clean when both old and new commit dates are unknown", async () => {
    const { user } = await createTestUser({ role: "admin" });
    const source = await createDueSource({ id: "example/no-commit-date", createdBy: user._id });
    source.lastReviewedAt = new Date("2026-07-01T02:00:00.000Z");
    await source.save();
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      lastUpstreamCommitAt: null,
      repositoryArchived: false,
      license: "NOASSERTION",
    });

    await refreshDueSkillRadarSources({ now: NOW });
    const saved = await SkillRadarSource.findById(source._id).lean();

    expect(saved.drift).toBe("clean");
  });

  it("keeps an unreviewed source due for review when upstream metadata is unchanged", async () => {
    const { user } = await createTestUser({ role: "admin" });
    const source = await createDueSource({ id: "example/unreviewed", createdBy: user._id });
    source.lastUpstreamCommitAt = new Date("2026-08-01T02:00:00.000Z");
    await source.save();
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      lastUpstreamCommitAt: "2026-08-01T02:00:00.000Z",
      repositoryArchived: false,
      license: "MIT",
    });

    await refreshDueSkillRadarSources({ now: NOW });
    const saved = await SkillRadarSource.findById(source._id).lean();

    expect(saved.lastReviewedAt).toBeNull();
    expect(saved.drift).toBe("review_due");
  });

  it("marks the remaining due sources rate-limited without another GitHub request", async () => {
    const { user } = await createTestUser({ role: "admin" });
    await createDueSource({ id: "example/first", createdBy: user._id });
    await createDueSource({ id: "example/second", createdBy: user._id });
    const analyze = vi.spyOn(skillRadarGithubService, "analyze").mockRejectedValue(
      Object.assign(new Error("limited"), {
        code: "SKILL_RADAR_GITHUB_RATE_LIMITED",
        retryAt: "2026-08-12T03:00:00.000Z",
      }),
    );

    const result = await refreshDueSkillRadarSources({ now: NOW });
    const sources = await SkillRadarSource.find({}).sort({ _id: 1 }).lean();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 2, refreshed: 0, rateLimited: 2, failed: 0 });
    expect(sources.map((source) => source.drift)).toEqual([
      "rate_limited",
      "rate_limited",
    ]);
    expect(sources.every((source) => source.rateLimitRetryAt.toISOString() === "2026-08-12T03:00:00.000Z")).toBe(true);
  });

  it("persists unreachable state while preserving last-known-good commit metadata", async () => {
    const { user } = await createTestUser({ role: "admin" });
    const source = await createDueSource({ id: "example/unreachable", createdBy: user._id });
    source.lastUpstreamCommitAt = new Date("2026-07-01T02:00:00.000Z");
    source.upstreamCommit = "knowncommit";
    await source.save();
    vi.spyOn(skillRadarGithubService, "analyze").mockRejectedValue(
      Object.assign(new Error("not found"), { code: "SOURCE_NOT_FOUND", status: 404 }),
    );

    const result = await refreshDueSkillRadarSources({ now: NOW });
    const saved = await SkillRadarSource.findById(source._id).lean();

    expect(result).toEqual({ checked: 1, refreshed: 0, rateLimited: 0, failed: 1 });
    expect(saved.drift).toBe("unreachable");
    expect(saved.upstreamCommit).toBe("knowncommit");
    expect(saved.lastUpstreamCommitAt.toISOString()).toBe("2026-07-01T02:00:00.000Z");
  });
});
