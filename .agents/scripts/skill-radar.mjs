#!/usr/bin/env node

import { createHash } from "node:crypto";

import { validateWatchlist } from "./skill-radar-contract.mjs";

export { validateWatchlist } from "./skill-radar-contract.mjs";
const ALLOWED_HOSTS = new Set([
  "api.github.com",
  "raw.githubusercontent.com",
]);
const MAX_RESPONSE_BYTES = 512 * 1024;

export function computeNextMonthlyRun(now = new Date()) {
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let candidate = new Date(Date.UTC(year, month, 1, 2, 0, 0));
  if (candidate <= now) {
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
    candidate = new Date(Date.UTC(year, month, 1, 2, 0, 0));
  }
  return candidate.toISOString();
}

const sanitizeError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 240);
};

const readLimitedText = async (response, maxBytes) => {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("Response exceeds size limit");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error("Response exceeds size limit");
  }
  return text;
};

const fetchWithPolicy = async ({
  fetchImpl,
  url,
  token,
  timeoutMs,
  maxBytes,
  retries,
}) => {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked upstream host: ${parsed.hostname}`);
  }
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "HTCOACHING-skill-radar" };
    if (token && parsed.hostname === "api.github.com") headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetchImpl(url, { headers, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} from ${parsed.hostname}`);
        error.status = response.status;
        error.host = parsed.hostname;
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          lastError = error;
          continue;
        }
        throw error;
      }
      return await readLimitedText(response, maxBytes);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || error?.name === "AbortError") throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
};

const fetchJson = async (options) => JSON.parse(await fetchWithPolicy(options));

const isRateLimitedError = (error) =>
  error?.status === 429 ||
  (error?.status === 403 && error?.host === "api.github.com");

const getPreviousById = (snapshot) =>
  new Map((snapshot?.items || []).map((item) => [item.id, item]));

const shouldWaitForScheduledCheck = (entry, previous, now) => {
  if (!["watch", "dormant"].includes(entry.lifecycle) || !previous.nextCheckAt) {
    return false;
  }
  const nextCheckAt = new Date(previous.nextCheckAt);
  return !Number.isNaN(nextCheckAt.getTime()) && nextCheckAt > now;
};

const carryPreviousObservation = (entry, previous) => ({
  id: entry.id,
  contentHash: previous.contentHash || null,
  upstreamCommit: previous.upstreamCommit || null,
  lastUpstreamCommitAt: previous.lastUpstreamCommitAt || null,
  repositoryArchived: Boolean(previous.repositoryArchived),
  lastCheckedAt: previous.lastCheckedAt || null,
  lastReviewedAt: previous.lastReviewedAt || null,
  nextCheckAt: previous.nextCheckAt,
  drift: previous.drift || "unknown",
  auditSummary: Array.isArray(previous.auditSummary) ? previous.auditSummary : [],
  decision: previous.decision || "pending",
  decisionReason: previous.decisionReason || null,
  reportPath: previous.reportPath || null,
  ...(previous.error ? { error: sanitizeError(previous.error) } : {}),
});

export async function scanWatchlist({
  watchlist,
  previousSnapshot = { schemaVersion: 1, items: [] },
  fetchImpl = globalThis.fetch,
  now = new Date(),
  token = process.env.GITHUB_TOKEN,
  timeoutMs = 10_000,
  maxBytes = MAX_RESPONSE_BYTES,
  retries = 1,
} = {}) {
  const validated = validateWatchlist(watchlist);
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");

  const previousById = getPreviousById(previousSnapshot);
  const repositoryCache = new Map();
  const items = [];
  let failures = 0;

  for (const entry of validated.entries) {
    const previous = previousById.get(entry.id) || {};
    const checkedAt = now.toISOString();
    const nextCheckAt = ["active", "candidate"].includes(entry.lifecycle)
      ? computeNextMonthlyRun(now)
      : new Date(
          now.getTime() + entry.reviewIntervalDays * 24 * 60 * 60 * 1000,
        ).toISOString();

    if (["archived", "rejected"].includes(entry.lifecycle)) {
      items.push({
        ...carryPreviousObservation(entry, previous),
        drift: previous.drift || "clean",
        nextCheckAt: null,
        decision: previous.decision || "defer",
      });
      continue;
    }

    if (shouldWaitForScheduledCheck(entry, previous, now)) {
      items.push(carryPreviousObservation(entry, previous));
      continue;
    }

    try {
      let repository = repositoryCache.get(entry.sourceRepo);
      if (!repository) {
        repository = await fetchJson({
          fetchImpl,
          url: `https://api.github.com/repos/${entry.sourceRepo}`,
          token,
          timeoutMs,
          maxBytes,
          retries,
        });
        repositoryCache.set(entry.sourceRepo, repository);
      }

      const encodedPath = entry.sourcePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      const commitUrl =
        `https://api.github.com/repos/${entry.sourceRepo}/commits?` +
        `path=${encodeURIComponent(entry.sourcePath)}&sha=${encodeURIComponent(entry.sourceBranch)}&per_page=1`;
      const rawUrl =
        `https://raw.githubusercontent.com/${entry.sourceRepo}/` +
        `${encodeURIComponent(entry.sourceBranch)}/${encodedPath}`;
      const [commits, contents] = await Promise.all([
        fetchJson({ fetchImpl, url: commitUrl, token, timeoutMs, maxBytes, retries }),
        fetchWithPolicy({ fetchImpl, url: rawUrl, token, timeoutMs, maxBytes, retries }),
      ]);
      const contentHash = createHash("sha256").update(contents).digest("hex");
      const changed = Boolean(previous.contentHash && previous.contentHash !== contentHash);
      const needsInitialReview = !previous.lastReviewedAt;
      const drift = repository.archived || repository.disabled
        ? "unreachable"
        : changed
          ? "changed"
          : needsInitialReview
            ? "review_due"
            : "clean";

      items.push({
        id: entry.id,
        contentHash,
        upstreamCommit: commits[0]?.sha?.slice(0, 12) || null,
        lastUpstreamCommitAt: commits[0]?.commit?.committer?.date || null,
        repositoryArchived: Boolean(repository.archived),
        lastCheckedAt: checkedAt,
        lastReviewedAt: previous.lastReviewedAt || null,
        nextCheckAt,
        drift,
        auditSummary: previous.auditSummary || [],
        decision: previous.decision || "pending",
        decisionReason: previous.decisionReason || null,
        reportPath: previous.reportPath || null,
      });
    } catch (error) {
      failures += 1;
      items.push({
        ...carryPreviousObservation(entry, previous),
        lastCheckedAt: checkedAt,
        nextCheckAt,
        drift: isRateLimitedError(error) ? "rate_limited" : "unreachable",
        error: sanitizeError(error),
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    failures,
    schedule: {
      ...validated.schedule,
      nextRunAt: computeNextMonthlyRun(now),
    },
    items,
  };
}
