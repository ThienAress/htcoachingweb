const KNOWN_MEDIA_CLASSES = new Set([
  "public_marketing",
  "user_avatar",
  "f1_private_image",
  "coaching_private_video",
]);
const SENSITIVE_MEDIA_CLASSES = new Set([
  "user_avatar",
  "f1_private_image",
  "coaching_private_video",
]);
const EVIDENCE_FIELDS = [
  "CLOUDINARY_BACKUP_CANARY_VERIFIED",
  "CLOUDINARY_BACKUP_RESTORE_CANARY_VERIFIED",
  "CLOUDINARY_BACKUP_PURGE_CANARY_VERIFIED",
];

const enabled = (value) => String(value || "").trim().toLowerCase() === "true";
const PLACEHOLDER_PATTERN =
  /^(?:changeme|example|none|pending|replace[-_ ]?me|todo)$/iu;
const splitClasses = (value) =>
  [...new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )];
const recordedEvidence = (value) =>
  /^[a-z0-9][a-z0-9._/-]{7,100}$/iu.test(String(value || "").trim()) &&
  !PLACEHOLDER_PATTERN.test(String(value || "").trim());

export const isSensitiveCloudinaryMediaClass = (mediaClass) =>
  SENSITIVE_MEDIA_CLASSES.has(String(mediaClass || "").trim().toLowerCase());

export const resolveCloudinaryBackupUploadOverride = (mediaClass) =>
  isSensitiveCloudinaryMediaClass(mediaClass) ? false : undefined;

export const evaluateCloudinaryBackupPolicy = (env = process.env) => {
  const backupEnabled = enabled(env.CLOUDINARY_BACKUP_ENABLED);
  const mediaClasses = splitClasses(env.CLOUDINARY_BACKUP_MEDIA_CLASSES);
  const blockers = [];
  if (!backupEnabled) {
    return { backupEnabled: false, mediaClasses: [], allowed: true, blockers };
  }

  if (!recordedEvidence(env.CLOUDINARY_BACKUP_POLICY_VERSION)) {
    blockers.push("CLOUDINARY_BACKUP_POLICY_REQUIRED");
  }
  if (!recordedEvidence(env.CLOUDINARY_BACKUP_APPROVAL_ID)) {
    blockers.push("CLOUDINARY_BACKUP_APPROVAL_REQUIRED");
  }
  if (mediaClasses.length === 0) {
    blockers.push("CLOUDINARY_BACKUP_MEDIA_CLASSES_REQUIRED");
  }
  if (mediaClasses.some((item) => !KNOWN_MEDIA_CLASSES.has(item))) {
    blockers.push("CLOUDINARY_BACKUP_MEDIA_CLASS_UNKNOWN");
  }
  if (mediaClasses.some(isSensitiveCloudinaryMediaClass)) {
    blockers.push("CLOUDINARY_BACKUP_SENSITIVE_MEDIA_BLOCKED");
  }
  blockers.push("CLOUDINARY_BACKUP_GLOBAL_SCOPE_UNVERIFIED");
  for (const field of EVIDENCE_FIELDS) {
    if (!enabled(env[field])) blockers.push(`${field}_REQUIRED`);
  }

  return {
    backupEnabled,
    mediaClasses,
    allowed: blockers.length === 0,
    blockers,
  };
};

export const evaluateCloudinaryDeletionEvidence = ({
  activeAssetDeleted = false,
  backupVersionPurged = false,
} = {}) => ({
  activeAssetDeleted: activeAssetDeleted === true,
  backupVersionPurged: backupVersionPurged === true,
  lifecycleComplete:
    activeAssetDeleted === true && backupVersionPurged === true,
});

export const CLOUDINARY_SENSITIVE_MEDIA_CLASSES = Object.freeze([
  ...SENSITIVE_MEDIA_CLASSES,
]);
