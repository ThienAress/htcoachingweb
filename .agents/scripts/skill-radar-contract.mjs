const LIFECYCLES = new Set([
  "candidate",
  "active",
  "watch",
  "dormant",
  "archived",
  "rejected",
]);
const TRUST_TIERS = new Set(["official", "expert", "community"]);

const requireString = (entry, field) => {
  if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
    throw new Error(`${entry.id || "entry"}: ${field} must be a non-empty string`);
  }
};

const requireHttpsUrl = (entry, field, allowedHosts) => {
  requireString(entry, field);
  let parsed;
  try {
    parsed = new URL(entry[field]);
  } catch {
    throw new Error(`${entry.id || "entry"}: ${field} must be a valid URL`);
  }
  if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) {
    throw new Error(`${entry.id || "entry"}: ${field} must use an allowlisted HTTPS host`);
  }
};

export function validateWatchlist(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.entries)) {
    throw new Error("Watchlist must use schemaVersion 1 and contain entries[]");
  }
  if (!input.schedule || input.schedule.cron !== "0 2 1 * *") {
    throw new Error("Watchlist schedule must be 0 2 1 * *");
  }
  if (input.schedule.timezone !== "Asia/Saigon") {
    throw new Error("Watchlist timezone must be Asia/Saigon");
  }

  const ids = new Set();
  for (const entry of input.entries) {
    for (const field of [
      "id",
      "name",
      "sourceRepo",
      "sourceBranch",
      "sourcePath",
      "domain",
      "summary",
      "addedAt",
      "license",
    ]) {
      requireString(entry, field);
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate id: ${entry.id}`);
    ids.add(entry.id);
    if (!/^[\w.-]+\/[\w.-]+$/.test(entry.sourceRepo)) {
      throw new Error(`${entry.id}: sourceRepo must be owner/repo`);
    }
    if (entry.sourcePath.startsWith("/") || entry.sourcePath.includes("..")) {
      throw new Error(`${entry.id}: sourcePath must stay inside the repository`);
    }
    requireHttpsUrl(entry, "repoUrl", new Set(["github.com"]));
    requireHttpsUrl(entry, "skillsShUrl", new Set(["skills.sh", "www.skills.sh"]));
    if (!TRUST_TIERS.has(entry.trustTier)) throw new Error(`${entry.id}: invalid trustTier`);
    if (!LIFECYCLES.has(entry.lifecycle)) throw new Error(`${entry.id}: invalid lifecycle`);
    if (!Number.isInteger(entry.reviewIntervalDays) || entry.reviewIntervalDays < 1) {
      throw new Error(`${entry.id}: reviewIntervalDays must be a positive integer`);
    }
    if (!Array.isArray(entry.localTargets) || entry.localTargets.length === 0) {
      throw new Error(`${entry.id}: localTargets must not be empty`);
    }
  }
  return input;
}
