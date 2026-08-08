import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WATCHLIST_PATH = path.join(ROOT, ".agents", "upstream-skills", "watchlist.json");
const SNAPSHOT_PATH = path.join(ROOT, ".agents", "upstream-skills", "snapshot.json");
const DRIFT_VALUES = new Set([
  "unknown",
  "clean",
  "changed",
  "review_due",
  "rate_limited",
  "unreachable",
  "audit_warning",
]);
const DECISION_VALUES = new Set(["pending", "adopt", "adapt", "reject", "defer"]);

const readJson = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
};

const sanitizeText = (value, maxLength = 240) =>
  typeof value === "string"
    ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
    : null;

const safeReportPath = (value) => {
  const sanitized = sanitizeText(value, 120)?.replaceAll("\\", "/");
  return /^docs\/audits\/\d{4}-\d{2}-skill-radar\.md$/.test(sanitized || "")
    ? sanitized
    : null;
};

const localTargetLabel = (target) => {
  const normalized = target.replaceAll("\\", "/");
  const skillMatch = normalized.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);
  if (skillMatch) return `$${skillMatch[1]}`;
  const ruleMatch = normalized.match(/^\.agents\/rules\/(?:[^/]+\/)*([^/]+)\.md$/);
  if (ruleMatch) return `${ruleMatch[1]} rule`;
  return path.basename(normalized).replace(/\.(?:mjs|md)$/i, "");
};

const nextMonthlyRun = (now) => {
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let candidate = new Date(Date.UTC(year, month, 1, 2));
  if (candidate <= now) {
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
    candidate = new Date(Date.UTC(year, month, 1, 2));
  }
  return candidate.toISOString();
};

const safeAuditSummary = (audits) =>
  Array.isArray(audits)
    ? audits.slice(0, 8).map((audit) => ({
        provider: sanitizeText(audit?.provider, 80),
        status: sanitizeText(audit?.status, 24),
        riskLevel: sanitizeText(audit?.riskLevel, 24),
        auditedAt: sanitizeText(audit?.auditedAt, 40),
      }))
    : [];

export const buildSkillRadarReadModel = ({ watchlist, snapshot, now = new Date() }) => {
  if (watchlist?.schemaVersion !== 1 || !Array.isArray(watchlist.entries)) {
    throw new Error("Invalid skill radar watchlist");
  }

  const snapshotItems = new Map(
    (snapshot?.schemaVersion === 1 && Array.isArray(snapshot.items) ? snapshot.items : [])
      .map((item) => [item.id, item]),
  );
  const items = watchlist.entries.map((entry) => {
    const observed = snapshotItems.get(entry.id) || {};
    const drift = DRIFT_VALUES.has(observed.drift)
      ? observed.drift
      : observed.lastReviewedAt
        ? "unknown"
        : "review_due";
    const decision = DECISION_VALUES.has(observed.decision)
      ? observed.decision
      : "pending";
    return {
      id: entry.id,
      name: entry.name,
      sourceRepo: entry.sourceRepo,
      repoUrl: entry.repoUrl,
      skillsShUrl: entry.skillsShUrl,
      domain: entry.domain,
      summary: entry.summary,
      localTargets: entry.localTargets.map(localTargetLabel),
      trustTier: entry.trustTier,
      lifecycle: entry.lifecycle,
      reviewIntervalDays: entry.reviewIntervalDays,
      license: entry.license,
      drift,
      contentHash: sanitizeText(observed.contentHash, 64),
      upstreamCommit: sanitizeText(observed.upstreamCommit, 12),
      lastUpstreamCommitAt: sanitizeText(observed.lastUpstreamCommitAt, 40),
      lastCheckedAt: sanitizeText(observed.lastCheckedAt, 40),
      lastReviewedAt: sanitizeText(observed.lastReviewedAt, 40),
      nextCheckAt: sanitizeText(observed.nextCheckAt, 40),
      repositoryArchived: Boolean(observed.repositoryArchived),
      auditSummary: safeAuditSummary(observed.auditSummary),
      decision,
      decisionReason: sanitizeText(observed.decisionReason),
      reportPath: safeReportPath(observed.reportPath),
    };
  });

  const count = (predicate) => items.filter(predicate).length;
  const summary = {
    total: items.length,
    active: count((item) => item.lifecycle === "active"),
    changed: count((item) => item.drift === "changed"),
    reviewDue: count((item) => item.drift === "review_due"),
    candidates: count((item) => item.lifecycle === "candidate"),
    dormant: count((item) => item.lifecycle === "dormant"),
    rateLimited: count((item) => item.drift === "rate_limited"),
    unreachable: count((item) => item.drift === "unreachable"),
  };
  const priority = new Map([
    ["changed", 0],
    ["audit_warning", 1],
    ["rate_limited", 2],
    ["unreachable", 3],
    ["review_due", 4],
    ["unknown", 5],
    ["clean", 6],
  ]);
  items.sort(
    (left, right) =>
      (priority.get(left.drift) ?? 9) - (priority.get(right.drift) ?? 9) ||
      left.name.localeCompare(right.name),
  );

  return {
    summary,
    schedule: {
      cron: watchlist.schedule?.cron || "0 2 1 * *",
      timezone: watchlist.schedule?.timezone || "Asia/Saigon",
      label: watchlist.schedule?.label || "09:00 ngày 1 mỗi tháng",
      nextRunAt: snapshot?.schedule?.nextRunAt || nextMonthlyRun(now),
      generatedAt: snapshot?.generatedAt || null,
      failures: Number.isInteger(snapshot?.failures) ? snapshot.failures : 0,
    },
    items,
  };
};

export const getAdminSkillRadar = () => {
  const watchlist = readJson(WATCHLIST_PATH, null);
  const snapshot = readJson(SNAPSHOT_PATH, { schemaVersion: 1, items: [] });
  return buildSkillRadarReadModel({ watchlist, snapshot });
};
