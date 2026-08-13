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
import { refreshDueSkillRadarSources } from "../skillRadar.service.js";
import { skillRadarGithubService } from "../skillRadarGithub.service.js";

const NOW = new Date("2026-08-12T02:00:00.000Z");

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
