const RINGS = new Set(["hold", "assess", "trial", "adopt"]);
const DECISIONS = new Set(["adapt", "defer", "reject", "adopt"]);
const TRUST_TIERS = new Set(["official", "expert", "community"]);

const requireString = (entry, field) => {
  if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
    throw new Error(`${entry.id || "entry"}: ${field} must be a non-empty string`);
  }
};

export function validateTechnologyRadar(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.entries)) {
    throw new Error("Technology radar must use schemaVersion 1 and entries[]");
  }
  const ids = new Set();
  for (const entry of input.entries) {
    for (const field of [
      "id",
      "name",
      "sourceRepo",
      "sourceBranch",
      "sourcePath",
      "repoUrl",
      "category",
      "summary",
      "decisionReason",
      "license",
      "reviewedAt",
      "nextReviewAt",
    ]) {
      requireString(entry, field);
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate technology id: ${entry.id}`);
    ids.add(entry.id);
    if (!/^[\w.-]+\/[\w.-]+$/.test(entry.sourceRepo)) {
      throw new Error(`${entry.id}: sourceRepo must be owner/repo`);
    }
    const repoUrl = new URL(entry.repoUrl);
    if (repoUrl.protocol !== "https:" || repoUrl.hostname !== "github.com") {
      throw new Error(`${entry.id}: repoUrl must use GitHub HTTPS`);
    }
    if (entry.sourcePath.startsWith("/") || entry.sourcePath.includes("..")) {
      throw new Error(`${entry.id}: sourcePath must stay inside the repository`);
    }
    if (!RINGS.has(entry.ring)) throw new Error(`${entry.id}: invalid ring`);
    if (!DECISIONS.has(entry.decision)) throw new Error(`${entry.id}: invalid decision`);
    if (!TRUST_TIERS.has(entry.trustTier)) {
      throw new Error(`${entry.id}: invalid trustTier`);
    }
    if (entry.autoInstall !== false) {
      throw new Error(`${entry.id}: autoInstall must remain false`);
    }
    if (!Array.isArray(entry.localTargets) || entry.localTargets.length === 0) {
      throw new Error(`${entry.id}: localTargets must not be empty`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.nextReviewAt)) {
      throw new Error(`${entry.id}: review dates must use YYYY-MM-DD`);
    }
  }
  return input;
}
