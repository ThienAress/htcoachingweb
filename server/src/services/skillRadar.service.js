import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SkillRadarSource from "../models/SkillRadarSource.js";
import AuditLog from "../models/AuditLog.js";
import {
  canonicalizeGithubRepositoryUrl,
  skillRadarGithubService,
} from "./skillRadarGithub.service.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WATCHLIST_PATH = path.join(ROOT, ".agents", "upstream-skills", "watchlist.json");
const SNAPSHOT_PATH = path.join(ROOT, ".agents", "upstream-skills", "snapshot.json");
const DRIFTS = new Set(["unknown", "clean", "changed", "review_due", "rate_limited", "unreachable", "audit_warning"]);
const DECISIONS = new Set(["pending", "adopt", "adapt", "reject", "defer"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_BY_LIFECYCLE = {
  candidate: 30,
  active: 30,
  watch: 90,
};

const readJson = (filePath, fallback) => {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")); } catch { return fallback; }
};
const sanitizeText = (value, max = 240) => typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : null;
const safeReportPath = (value) => {
  const clean = sanitizeText(value, 120)?.replaceAll("\\", "/");
  return /^docs\/audits\/\d{4}-\d{2}-skill-radar\.md$/.test(clean || "") ? clean : null;
};
const localTargetLabel = (target) => {
  const normalized = target.replaceAll("\\", "/");
  const skill = normalized.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);
  if (skill) return `$${skill[1]}`;
  const rule = normalized.match(/^\.agents\/rules\/(?:[^/]+\/)*([^/]+)\.md$/);
  if (rule) return `${rule[1]} rule`;
  return path.basename(normalized).replace(/\.(?:mjs|md)$/i, "");
};
const nextMonthlyRun = (now) => {
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let candidate = new Date(Date.UTC(year, month, 1, 2));
  if (candidate <= now) {
    month += 1;
    if (month > 11) { year += 1; month = 0; }
    candidate = new Date(Date.UTC(year, month, 1, 2));
  }
  return candidate.toISOString();
};
const nextCheckFor = (now, reviewIntervalDays) =>
  new Date(now.getTime() + reviewIntervalDays * DAY_MS);
const isSameInstant = (left, right) => {
  const leftTime = left ? new Date(left).getTime() : null;
  const rightTime = right ? new Date(right).getTime() : null;
  if (leftTime === null && rightTime === null) return true;
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
};
const safeAudits = (audits) => Array.isArray(audits) ? audits.slice(0, 8).map((audit) => ({
  provider: sanitizeText(audit?.provider, 80), status: sanitizeText(audit?.status, 24),
  riskLevel: sanitizeText(audit?.riskLevel, 24), auditedAt: sanitizeText(audit?.auditedAt, 40),
})) : [];

export const buildSkillRadarReadModel = ({ watchlist, snapshot, now = new Date() }) => {
  if (watchlist?.schemaVersion !== 1 || !Array.isArray(watchlist.entries)) throw new Error("Invalid skill radar watchlist");
  const observedById = new Map((snapshot?.schemaVersion === 1 && Array.isArray(snapshot.items) ? snapshot.items : []).map((item) => [item.id, item]));
  const items = watchlist.entries.map((entry) => {
    const observed = observedById.get(entry.id) || {};
    return {
      id: entry.id, sourceType: entry.sourceType || "skill", name: entry.name,
      sourceRepo: entry.sourceRepo, repoUrl: entry.repoUrl, skillsShUrl: entry.skillsShUrl || null,
      domain: entry.domain, summary: entry.summary,
      localTargets: (entry.localTargets || []).map(localTargetLabel), trustTier: entry.trustTier,
      lifecycle: entry.lifecycle, reviewIntervalDays: entry.reviewIntervalDays, license: entry.license,
      drift: DRIFTS.has(observed.drift) ? observed.drift : observed.lastReviewedAt ? "unknown" : "review_due",
      contentHash: sanitizeText(observed.contentHash, 64), upstreamCommit: sanitizeText(observed.upstreamCommit, 12),
      lastUpstreamCommitAt: sanitizeText(observed.lastUpstreamCommitAt, 40), lastCheckedAt: sanitizeText(observed.lastCheckedAt, 40),
      lastReviewedAt: sanitizeText(observed.lastReviewedAt, 40), nextCheckAt: sanitizeText(observed.nextCheckAt, 40),
      rateLimitRetryAt: sanitizeText(observed.rateLimitRetryAt, 40), repositoryArchived: Boolean(observed.repositoryArchived),
      auditSummary: safeAudits(observed.auditSummary), decision: DECISIONS.has(observed.decision) ? observed.decision : "pending",
      decisionReason: sanitizeText(observed.decisionReason), reportPath: safeReportPath(observed.reportPath),
    };
  });
  const count = (predicate) => items.filter(predicate).length;
  const priority = new Map([["changed", 0], ["audit_warning", 1], ["rate_limited", 2], ["unreachable", 3], ["review_due", 4], ["unknown", 5], ["clean", 6]]);
  items.sort((a, b) => (priority.get(a.drift) ?? 9) - (priority.get(b.drift) ?? 9) || a.name.localeCompare(b.name));
  return {
    summary: { total: items.length, active: count((x) => x.lifecycle === "active"), changed: count((x) => x.drift === "changed"), reviewDue: count((x) => x.drift === "review_due"), candidates: count((x) => x.lifecycle === "candidate"), dormant: count((x) => x.lifecycle === "dormant"), rateLimited: count((x) => x.drift === "rate_limited"), unreachable: count((x) => x.drift === "unreachable") },
    schedule: { cron: watchlist.schedule?.cron || "0 2 1 * *", timezone: watchlist.schedule?.timezone || "Asia/Saigon", label: watchlist.schedule?.label || "09:00 ngày 1 mỗi tháng", nextRunAt: snapshot?.schedule?.nextRunAt || nextMonthlyRun(now), generatedAt: snapshot?.generatedAt || null, failures: Number.isInteger(snapshot?.failures) ? snapshot.failures : 0 },
    items,
  };
};

const readFiles = () => ({
  watchlist: readJson(WATCHLIST_PATH, null),
  snapshot: readJson(SNAPSHOT_PATH, { schemaVersion: 1, items: [] }),
});
export const getAdminSkillRadar = () => { const { watchlist, snapshot } = readFiles(); return buildSkillRadarReadModel({ watchlist, snapshot }); };
const dynamicEntry = (s) => ({ id: s._id, sourceType: s.sourceType, name: s.name, sourceRepo: s.sourceRepo, repoUrl: s.repoUrl, skillsShUrl: s.skillsShUrl, domain: s.domain, summary: s.summary, localTargets: s.localTargets, trustTier: s.trustTier, lifecycle: s.lifecycle, reviewIntervalDays: s.reviewIntervalDays, license: s.license });
const dynamicObserved = (s) => ({ id: s._id, drift: s.drift, upstreamCommit: s.upstreamCommit, lastUpstreamCommitAt: s.lastUpstreamCommitAt?.toISOString?.() || null, lastCheckedAt: s.lastCheckedAt?.toISOString?.() || null, lastReviewedAt: s.lastReviewedAt?.toISOString?.() || null, nextCheckAt: s.nextCheckAt?.toISOString?.() || null, rateLimitRetryAt: s.rateLimitRetryAt?.toISOString?.() || null, repositoryArchived: s.repositoryArchived, auditSummary: s.auditSummary, decision: s.decision || "pending", decisionReason: s.decisionReason });
export const getAdminSkillRadarWithDynamicSources = async () => {
  const { watchlist, snapshot } = readFiles();
  if (watchlist?.schemaVersion !== 1 || !Array.isArray(watchlist.entries)) {
    throw new Error("Invalid skill radar watchlist");
  }
  const dynamic = await SkillRadarSource.find({})
    .select("-createdBy -auditLogId -createdAt -updatedAt -__v")
    .sort({ createdAt: 1 })
    .lean();
  return buildSkillRadarReadModel({ watchlist: { ...watchlist, entries: [...watchlist.entries, ...dynamic.map(dynamicEntry)] }, snapshot: { ...snapshot, items: [...(snapshot.items || []), ...dynamic.map(dynamicObserved)] } });
};
export const previewSkillRadarSource = (sourceUrl) =>
  skillRadarGithubService.analyze(sourceUrl);
const conflict = () => Object.assign(
  new Error("Nguồn này đã có trong Radar công nghệ"),
  { status: 409, code: "SKILL_RADAR_SOURCE_DUPLICATE" },
);
const writeSkillRadarAudit = ({ createdBy, sourceKey, sourceType, lifecycle, outcome }) =>
  AuditLog.create({
    actorId: createdBy,
    actorRole: "admin",
    action: "create_skill_radar_source",
    targetType: "skill_radar_source",
    targetKey: sourceKey,
    outcome,
    metadata: { sourceType, lifecycle },
  });
export const createSkillRadarSource = async (payload, createdBy) => {
  const canonical = canonicalizeGithubRepositoryUrl(payload.sourceUrl);
  const { watchlist } = readFiles();
  const isStaticDuplicate = watchlist.entries.some(
    (entry) => entry.sourceRepo?.toLowerCase() === canonical.sourceKey,
  );
  if (isStaticDuplicate || await SkillRadarSource.exists({ _id: canonical.sourceKey })) {
    throw conflict();
  }
  const analyzed = await skillRadarGithubService.analyze(canonical.repoUrl);
  if (analyzed.sourceKey && analyzed.sourceKey !== canonical.sourceKey) {
    throw Object.assign(new Error("GitHub repository đã đổi định danh"), {
      code: "SKILL_RADAR_SOURCE_IDENTITY_CHANGED",
      status: 409,
    });
  }
  if (await SkillRadarSource.exists({ _id: canonical.sourceKey })) throw conflict();
  const reviewIntervalDays = REVIEW_INTERVAL_BY_LIFECYCLE[payload.lifecycle] || 30;
  const analyzedAt = new Date(analyzed.lastCheckedAt);
  const baselineAt = Number.isNaN(analyzedAt.getTime()) ? new Date() : analyzedAt;
  const audit = await writeSkillRadarAudit({
    createdBy,
    sourceKey: canonical.sourceKey,
    sourceType: payload.sourceType,
    lifecycle: payload.lifecycle,
    outcome: "failed",
  });
  const source = new SkillRadarSource({
    _id: canonical.sourceKey,
    sourceType: payload.sourceType,
    name: payload.name,
    sourceRepo: analyzed.sourceRepo || canonical.sourceRepo,
    repoUrl: analyzed.repoUrl || canonical.repoUrl,
    skillsShUrl: analyzed.skillsShUrl,
    domain: payload.domain,
    summary: payload.summary,
    localTargets: [...new Set(payload.localTargets)],
    trustTier: analyzed.trustTier,
    lifecycle: payload.lifecycle,
    reviewIntervalDays,
    license: analyzed.license,
    drift: "review_due",
    upstreamCommit: null,
    lastUpstreamCommitAt: analyzed.lastUpstreamCommitAt,
    lastCheckedAt: analyzed.lastCheckedAt,
    lastReviewedAt: null,
    nextCheckAt: nextCheckFor(baselineAt, reviewIntervalDays),
    repositoryArchived: analyzed.repositoryArchived,
    createdBy,
    auditLogId: audit._id,
  });
  await source.validate();
  try {
    await source.save({ validateBeforeSave: false });
  } catch (writeError) {
    audit.outcome = "failed";
    audit.metadata = {
      ...audit.metadata,
      failureCode: writeError?.code === 11000 ? "duplicate" : "persistence_failed",
    };
    await audit.save();
    if (writeError?.code === 11000) throw conflict();
    throw writeError;
  }
  audit.outcome = "succeeded";
  await audit.save();
  return buildSkillRadarReadModel({
    watchlist: { schemaVersion: 1, schedule: {}, entries: [dynamicEntry(source.toObject())] },
    snapshot: { schemaVersion: 1, items: [dynamicObserved(source.toObject())] },
  }).items[0];
};
export const refreshDueSkillRadarSources = async ({ now = new Date() } = {}) => {
  const sources = await SkillRadarSource.find({ lifecycle: { $in: ["candidate", "active", "watch"] }, nextCheckAt: { $lte: now } });
  const result = { checked: 0, refreshed: 0, rateLimited: 0, failed: 0 };
  let batchRetryAt = null;
  for (const source of sources) {
    result.checked += 1;
    if (batchRetryAt) {
      Object.assign(source, {
        drift: "rate_limited",
        lastCheckedAt: now,
        nextCheckAt: batchRetryAt,
        rateLimitRetryAt: batchRetryAt,
      });
      await source.save();
      result.rateLimited += 1;
      continue;
    }
    try {
      const analyzed = await skillRadarGithubService.analyze(source.repoUrl, now);
      Object.assign(source, {
        lastUpstreamCommitAt: analyzed.lastUpstreamCommitAt,
        lastCheckedAt: now,
        nextCheckAt: nextCheckFor(now, source.reviewIntervalDays),
        rateLimitRetryAt: null,
        repositoryArchived: analyzed.repositoryArchived,
        license: analyzed.license,
        drift: source.lastReviewedAt
          ? (isSameInstant(
            source.lastUpstreamCommitAt,
            analyzed.lastUpstreamCommitAt,
          ) ? "clean" : "changed")
          : "review_due",
      });
      await source.save();
      result.refreshed += 1;
    } catch (error) {
      if (error?.code === "SKILL_RADAR_GITHUB_RATE_LIMITED") {
        const parsedRetryAt = error.retryAt ? new Date(error.retryAt) : null;
        batchRetryAt = parsedRetryAt && parsedRetryAt > now
          ? parsedRetryAt
          : nextCheckFor(now, source.reviewIntervalDays);
        Object.assign(source, {
          drift: "rate_limited",
          lastCheckedAt: now,
          nextCheckAt: batchRetryAt,
          rateLimitRetryAt: batchRetryAt,
        });
        await source.save();
        result.rateLimited += 1;
        continue;
      }
      Object.assign(source, {
        drift: "unreachable",
        lastCheckedAt: now,
        nextCheckAt: nextCheckFor(now, source.reviewIntervalDays),
        rateLimitRetryAt: null,
      });
      await source.save();
      result.failed += 1;
    }
  }
  return result;
};
