const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "policy",
  "latestVerifiedBackup",
]);
const POLICY_FIELDS = new Set([
  "releaseMaxAgeHours",
  "requireOffDeviceRecovery",
]);
const BACKUP_FIELDS = new Set([
  "backupId",
  "completedAt",
  "backupType",
  "archiveIntegrityVerified",
  "isolatedRestoreVerified",
  "sourceFingerprintMatched",
  "continuousRecoveryAvailable",
  "offDeviceRecoveryVerified",
  "evidence",
]);
const BACKUP_TYPES = new Set(["logical_mongodump", "atlas_snapshot"]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertPlainObject = (value, name) => {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${name} must be an object`,
  );
};

const assertAllowedFields = (value, allowed, name) => {
  for (const field of Object.keys(value)) {
    assert(allowed.has(field), `${name} contains unsupported field: ${field}`);
  }
};

const assertBoolean = (value, name) => {
  assert(typeof value === "boolean", `${name} must be a boolean`);
};

export const validateBackupManifest = (
  manifest,
  { now = new Date() } = {},
) => {
  assertPlainObject(manifest, "Backup readiness manifest");
  assertAllowedFields(manifest, TOP_LEVEL_FIELDS, "Backup readiness manifest");
  assert(manifest.schemaVersion === 1, "Unsupported backup manifest schemaVersion");

  assertPlainObject(manifest.policy, "Backup policy");
  assertAllowedFields(manifest.policy, POLICY_FIELDS, "Backup policy");
  assert(
    Number.isInteger(manifest.policy.releaseMaxAgeHours) &&
      manifest.policy.releaseMaxAgeHours >= 1 &&
      manifest.policy.releaseMaxAgeHours <= 168,
    "releaseMaxAgeHours must be an integer between 1 and 168",
  );
  assert(
    manifest.policy.requireOffDeviceRecovery === true,
    "requireOffDeviceRecovery must remain enabled",
  );

  const backup = manifest.latestVerifiedBackup;
  assertPlainObject(backup, "Latest verified backup");
  assertAllowedFields(backup, BACKUP_FIELDS, "Latest verified backup");
  assert(
    /^production-[a-z0-9-]{8,100}$/i.test(backup.backupId),
    "backupId has an invalid format",
  );
  assert(BACKUP_TYPES.has(backup.backupType), "backupType is not supported");
  assert(
    /^docs\/operations\/production\/[a-z0-9./-]+\.md$/i.test(backup.evidence) &&
      !backup.evidence.includes(".."),
    "evidence must be a repository-relative production document",
  );

  for (const field of [
    "archiveIntegrityVerified",
    "isolatedRestoreVerified",
    "sourceFingerprintMatched",
    "continuousRecoveryAvailable",
    "offDeviceRecoveryVerified",
  ]) {
    assertBoolean(backup[field], field);
  }

  const completedAt = new Date(backup.completedAt);
  assert(
    Number.isFinite(completedAt.getTime()),
    "completedAt must be a valid ISO timestamp",
  );
  assert(
    completedAt.toISOString() === backup.completedAt,
    "completedAt must use canonical ISO format",
  );
  assert(now instanceof Date && Number.isFinite(now.getTime()), "now is invalid");
  assert(completedAt.getTime() <= now.getTime(), "completedAt cannot be in the future");

  return { backup, completedAt };
};

const finding = (code, message) => ({ code, message });

export const evaluateBackupReadiness = (manifest, options = {}) => {
  const now = options.now || new Date();
  const { backup, completedAt } = validateBackupManifest(manifest, { now });
  const ageHours = Number(
    ((now.getTime() - completedAt.getTime()) / 3_600_000).toFixed(2),
  );
  const blockers = [];
  const warnings = [];

  if (ageHours > manifest.policy.releaseMaxAgeHours) {
    blockers.push(
      finding(
        "BACKUP_STALE",
        `Latest verified backup is ${ageHours} hours old; release limit is ${manifest.policy.releaseMaxAgeHours} hours`,
      ),
    );
  }
  if (!backup.archiveIntegrityVerified) {
    blockers.push(
      finding("ARCHIVE_INTEGRITY_UNVERIFIED", "Archive integrity is not verified"),
    );
  }
  if (!backup.isolatedRestoreVerified) {
    blockers.push(
      finding("ISOLATED_RESTORE_UNVERIFIED", "Isolated restore is not verified"),
    );
  }
  if (!backup.sourceFingerprintMatched) {
    blockers.push(
      finding("SOURCE_FINGERPRINT_MISMATCH", "Restored data fingerprint is not verified"),
    );
  }
  if (!backup.offDeviceRecoveryVerified) {
    blockers.push(
      finding(
        "OFF_DEVICE_RECOVERY_UNVERIFIED",
        "Independently recoverable off-device copy is not verified",
      ),
    );
  }
  if (!backup.continuousRecoveryAvailable) {
    warnings.push(
      finding(
        "CONTINUOUS_RECOVERY_UNAVAILABLE",
        "Point-in-time or continuous recovery is unavailable; documented logical-backup RPO applies",
      ),
    );
  }

  const releaseBlockerCodes = new Set([
    "BACKUP_STALE",
    "ARCHIVE_INTEGRITY_UNVERIFIED",
    "ISOLATED_RESTORE_UNVERIFIED",
    "SOURCE_FINGERPRINT_MISMATCH",
  ]);
  const releaseReady = !blockers.some(({ code }) => releaseBlockerCodes.has(code));
  const disasterRecoveryReady =
    releaseReady &&
    (!manifest.policy.requireOffDeviceRecovery || backup.offDeviceRecoveryVerified);

  return {
    backupId: backup.backupId,
    completedAt: backup.completedAt,
    evidence: backup.evidence,
    ageHours,
    releaseMaxAgeHours: manifest.policy.releaseMaxAgeHours,
    releaseReady,
    disasterRecoveryReady,
    continuousRecoveryAvailable: backup.continuousRecoveryAvailable,
    blockers,
    warnings,
  };
};

export const exitCodeForMode = (mode, result) => {
  if (mode === "audit") return 0;
  if (mode === "release") return result.releaseReady ? 0 : 1;
  if (mode === "disaster-recovery") {
    return result.disasterRecoveryReady ? 0 : 1;
  }
  throw new Error(`Unsupported mode: ${mode}`);
};
