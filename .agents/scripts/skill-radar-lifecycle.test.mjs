import assert from "node:assert/strict";
import test from "node:test";

import { scanWatchlist } from "./skill-radar.mjs";

const baseEntry = {
  id: "example/skills/example-skill",
  name: "example-skill",
  sourceRepo: "example/skills",
  sourceBranch: "main",
  sourcePath: "skills/example-skill/SKILL.md",
  repoUrl: "https://github.com/example/skills",
  skillsShUrl: "https://www.skills.sh/example/skills/example-skill",
  domain: "testing",
  summary: "Example upstream skill",
  localTargets: [".agents/skills/qa/SKILL.md"],
  trustTier: "expert",
  lifecycle: "active",
  reviewIntervalDays: 30,
  addedAt: "2026-08-08",
  license: "MIT",
};

const watchlist = {
  schemaVersion: 1,
  schedule: {
    cron: "0 2 1 * *",
    timezone: "Asia/Saigon",
  },
  entries: [baseEntry],
};

test("watch and dormant sources wait until their scheduled check", async () => {
  for (const lifecycle of ["watch", "dormant"]) {
    let fetchCalls = 0;
    const scheduledWatchlist = {
      ...watchlist,
      entries: [{ ...baseEntry, lifecycle, reviewIntervalDays: 90 }],
    };
    const result = await scanWatchlist({
      watchlist: scheduledWatchlist,
      previousSnapshot: {
        schemaVersion: 1,
        items: [{
          id: baseEntry.id,
          contentHash: "known-hash",
          lastCheckedAt: "2026-08-01T02:00:00.000Z",
          nextCheckAt: "2026-10-30T02:00:00.000Z",
          drift: "clean",
        }],
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("fetch should not run before nextCheckAt");
      },
      now: new Date("2026-09-01T02:00:00.000Z"),
    });

    assert.equal(fetchCalls, 0);
    assert.equal(result.items[0].nextCheckAt, "2026-10-30T02:00:00.000Z");
    assert.equal(result.items[0].contentHash, "known-hash");
  }
});

test("terminal lifecycles keep tombstones without fetching upstream", async () => {
  for (const lifecycle of ["archived", "rejected"]) {
    let fetchCalls = 0;
    const terminalWatchlist = {
      ...watchlist,
      entries: [{ ...baseEntry, lifecycle }],
    };
    const originalWatchlist = JSON.stringify(terminalWatchlist);
    const result = await scanWatchlist({
      watchlist: terminalWatchlist,
      previousSnapshot: {
        schemaVersion: 1,
        items: [{
          id: baseEntry.id,
          upstreamCommit: "abc123",
          auditSummary: [{ provider: "skills.sh", status: "pass" }],
          reportPath: "docs/audits/2026-08-skill-radar.md",
        }],
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("terminal lifecycle must not fetch");
      },
      now: new Date("2026-08-08T10:00:00.000Z"),
    });

    assert.equal(fetchCalls, 0);
    assert.equal(result.items[0].nextCheckAt, null);
    assert.equal(result.items[0].decision, "defer");
    assert.equal(result.items[0].upstreamCommit, "abc123");
    assert.equal(result.items[0].auditSummary.length, 1);
    assert.equal(result.items[0].reportPath, "docs/audits/2026-08-skill-radar.md");
    assert.equal(JSON.stringify(terminalWatchlist), originalWatchlist);
  }
});
