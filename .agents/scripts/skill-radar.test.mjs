import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeNextMonthlyRun,
  scanWatchlist,
  validateWatchlist,
} from "./skill-radar.mjs";

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

test("validateWatchlist accepts a versioned unique HTTPS watchlist", () => {
  assert.equal(validateWatchlist(watchlist).entries.length, 1);
});

test("project watchlist tracks the approved Emil animation inputs", () => {
  const projectWatchlist = validateWatchlist(
    JSON.parse(
      readFileSync(
        new URL("../upstream-skills/watchlist.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const ids = new Set(projectWatchlist.entries.map(({ id }) => id));

  assert.equal(ids.has("emilkowalski/skills/emil-design-eng"), true);
  assert.equal(ids.has("emilkowalski/skills/review-animations"), true);
  assert.equal(ids.has("emilkowalski/skills/improve-animations"), true);
});

test("validateWatchlist rejects duplicate ids", () => {
  assert.throws(
    () => validateWatchlist({ ...watchlist, entries: [baseEntry, baseEntry] }),
    /duplicate id/i,
  );
});

test("computeNextMonthlyRun returns 09:00 Asia/Saigon on the next first day", () => {
  assert.equal(
    computeNextMonthlyRun(new Date("2026-08-08T10:00:00.000Z")),
    "2026-09-01T02:00:00.000Z",
  );
});

test("scanWatchlist detects content drift without retaining raw skill contents", async () => {
  const oldHash = createHash("sha256").update("old contents").digest("hex");
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response("new contents", {
        status: 200,
        headers: { "content-length": "12" },
      });
    }
    if (url.includes("/commits?")) {
      return Response.json([
        {
          sha: "abcdef1234567890",
          commit: { committer: { date: "2026-08-07T10:00:00.000Z" } },
        },
      ]);
    }
    return Response.json({ archived: false, disabled: false });
  };

  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: {
      schemaVersion: 1,
      items: [{ id: baseEntry.id, contentHash: oldHash }],
    },
    fetchImpl,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].drift, "changed");
  assert.equal(result.items[0].lastUpstreamCommitAt, "2026-08-07T10:00:00.000Z");
  assert.equal(result.items[0].nextCheckAt, "2026-09-01T02:00:00.000Z");
  assert.equal(JSON.stringify(result).includes("new contents"), false);
  assert.equal(calls.length, 3);
  assert.equal(calls.every(({ options }) => options.redirect === "error"), true);
});

test("scanWatchlist marks an unchanged reviewed source as clean", async () => {
  const contentHash = createHash("sha256").update("same contents").digest("hex");
  const fetchImpl = async (url) => {
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response("same contents", { status: 200 });
    }
    if (url.includes("/commits?")) return Response.json([]);
    return Response.json({ archived: false, disabled: false });
  };

  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: {
      schemaVersion: 1,
      items: [{
        id: baseEntry.id,
        contentHash,
        lastReviewedAt: "2026-08-01T02:00:00.000Z",
      }],
    },
    fetchImpl,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].drift, "clean");
});

test("scanWatchlist keeps an unchanged first baseline due for semantic review", async () => {
  const contentHash = createHash("sha256").update("same contents").digest("hex");
  const fetchImpl = async (url) => {
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response("same contents", { status: 200 });
    }
    if (url.includes("/commits?")) return Response.json([]);
    return Response.json({ archived: false, disabled: false });
  };

  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: {
      schemaVersion: 1,
      items: [{ id: baseEntry.id, contentHash }],
    },
    fetchImpl,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].drift, "review_due");
  assert.equal(result.items[0].lastReviewedAt, null);
});

test("scanWatchlist retries a retryable GitHub response", async () => {
  let repositoryAttempts = 0;
  const fetchImpl = async (url) => {
    if (url === "https://api.github.com/repos/example/skills") {
      repositoryAttempts += 1;
      if (repositoryAttempts === 1) return new Response("busy", { status: 503 });
      return Response.json({ archived: false, disabled: false });
    }
    if (url.includes("/commits?")) return Response.json([]);
    return new Response("contents", { status: 200 });
  };

  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: { schemaVersion: 1, items: [] },
    fetchImpl,
    retries: 1,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(repositoryAttempts, 2);
  assert.equal(result.failures, 0);
});

test("scanWatchlist classifies GitHub API limits without losing last-known-good provenance", async () => {
  for (const status of [403, 429]) {
    const result = await scanWatchlist({
      watchlist,
      previousSnapshot: {
        schemaVersion: 1,
        items: [{
          id: baseEntry.id,
          contentHash: "known-hash",
          upstreamCommit: "abc123def456",
          lastUpstreamCommitAt: "2026-08-01T02:00:00.000Z",
          repositoryArchived: false,
          lastReviewedAt: "2026-08-02T02:00:00.000Z",
          drift: "clean",
          decision: "adapt",
          decisionReason: "Approved baseline finding",
          reportPath: "docs/audits/2026-08-skill-radar.md",
        }],
      },
      fetchImpl: async () => new Response("limited", {
        status,
        headers: { "x-ratelimit-reset": "1786165200" },
      }),
      retries: 0,
      now: new Date("2026-08-08T10:00:00.000Z"),
    });

    assert.equal(result.failures, 1);
    assert.equal(result.items[0].drift, "rate_limited");
    assert.equal(result.items[0].contentHash, "known-hash");
    assert.equal(result.items[0].upstreamCommit, "abc123def456");
    assert.equal(result.items[0].decision, "adapt");
    assert.equal(result.items[0].rateLimitRetryAt, "2026-08-08T05:00:00.000Z");
    assert.match(result.items[0].error, new RegExp(`HTTP ${status}`));
  }
});

test("scanWatchlist accepts HTTP-date Retry-After metadata", async () => {
  const result = await scanWatchlist({
    watchlist,
    fetchImpl: async () => new Response("limited", {
      status: 429,
      headers: { "retry-after": "Sat, 08 Aug 2026 11:00:00 GMT" },
    }),
    retries: 0,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].rateLimitRetryAt, "2026-08-08T11:00:00.000Z");
});

test("scanWatchlist stops new GitHub calls after a repository hits the API limit", async () => {
  const secondEntry = {
    ...baseEntry,
    id: "second/repository/second-skill",
    name: "second-skill",
    sourceRepo: "second/repository",
    repoUrl: "https://github.com/second/repository",
    skillsShUrl: "https://www.skills.sh/second/repository/second-skill",
  };
  let calls = 0;
  const result = await scanWatchlist({
    watchlist: { ...watchlist, entries: [baseEntry, secondEntry] },
    previousSnapshot: {
      schemaVersion: 1,
      items: [{
        id: secondEntry.id,
        contentHash: "second-known-hash",
        upstreamCommit: "secondcommit",
      }],
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response("limited", {
        status: 429,
        headers: { "retry-after": "120" },
      });
    },
    retries: 0,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(calls, 1);
  assert.equal(result.failures, 2);
  assert.equal(result.items[1].drift, "rate_limited");
  assert.equal(result.items[1].contentHash, "second-known-hash");
  assert.equal(result.items[1].upstreamCommit, "secondcommit");
  assert.equal(result.items[1].rateLimitRetryAt, "2026-08-08T10:02:00.000Z");
});

test("scanWatchlist isolates a timed-out source", async () => {
  const fetchImpl = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("request timed out");
        error.name = "AbortError";
        reject(error);
      });
    });

  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: { schemaVersion: 1, items: [] },
    fetchImpl,
    timeoutMs: 5,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.failures, 1);
  assert.equal(result.items[0].drift, "unreachable");
  assert.match(result.items[0].error, /timed out/i);
});

test("scanWatchlist isolates an unreachable source", async () => {
  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: { schemaVersion: 1, items: [] },
    fetchImpl: async () => new Response("not found", { status: 404 }),
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].drift, "unreachable");
  assert.equal(result.failures, 1);
  assert.match(result.items[0].error, /HTTP 404/);
});

test("scanWatchlist rejects oversized upstream content", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://api.github.com/repos/example/skills") {
      return Response.json({ archived: false, disabled: false });
    }
    if (url.includes("/commits?")) return Response.json([]);
    return new Response("oversized", {
      status: 200,
      headers: { "content-length": "1024" },
    });
  };
  const result = await scanWatchlist({
    watchlist,
    previousSnapshot: { schemaVersion: 1, items: [] },
    fetchImpl,
    maxBytes: 32,
    now: new Date("2026-08-08T10:00:00.000Z"),
  });

  assert.equal(result.items[0].drift, "unreachable");
  assert.match(result.items[0].error, /size limit/);
});
