import { describe, expect, it } from "vitest";

import {
  evaluateCloudinaryBackupPolicy,
  evaluateCloudinaryDeletionEvidence,
  isSensitiveCloudinaryMediaClass,
  resolveCloudinaryBackupUploadOverride,
} from "../cloudinaryBackupPolicy.js";

const approvedPublicBackup = () => ({
  CLOUDINARY_BACKUP_ENABLED: "true",
  CLOUDINARY_BACKUP_MEDIA_CLASSES: "public_marketing",
  CLOUDINARY_BACKUP_POLICY_VERSION: "cloudinary-backup-v1",
  CLOUDINARY_BACKUP_APPROVAL_ID: "owner-approved-20260906",
  CLOUDINARY_BACKUP_CANARY_VERIFIED: "true",
  CLOUDINARY_BACKUP_RESTORE_CANARY_VERIFIED: "true",
  CLOUDINARY_BACKUP_PURGE_CANARY_VERIFIED: "true",
});

describe("Cloudinary backup-version privacy policy", () => {
  it("keeps backup disabled safely by default", () => {
    expect(evaluateCloudinaryBackupPolicy({})).toEqual({
      backupEnabled: false,
      mediaClasses: [],
      allowed: true,
      blockers: [],
    });
  });

  it("blocks global backup until every upload class and deletion lifecycle is inventoried", () => {
    expect(evaluateCloudinaryBackupPolicy(approvedPublicBackup())).toMatchObject({
      backupEnabled: true,
      mediaClasses: ["public_marketing"],
      allowed: false,
      blockers: ["CLOUDINARY_BACKUP_GLOBAL_SCOPE_UNVERIFIED"],
    });
  });

  it("always blocks F1 and coaching private media backup versions", () => {
    const env = approvedPublicBackup();
    env.CLOUDINARY_BACKUP_MEDIA_CLASSES =
      "public_marketing,f1_private_image,coaching_private_video";
    expect(evaluateCloudinaryBackupPolicy(env)).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        "CLOUDINARY_BACKUP_SENSITIVE_MEDIA_BLOCKED",
        "CLOUDINARY_BACKUP_GLOBAL_SCOPE_UNVERIFIED",
      ]),
    });
    expect(isSensitiveCloudinaryMediaClass("f1_private_image")).toBe(true);
    expect(isSensitiveCloudinaryMediaClass("coaching_private_video")).toBe(true);
    expect(isSensitiveCloudinaryMediaClass("user_avatar")).toBe(true);
    expect(resolveCloudinaryBackupUploadOverride("user_avatar")).toBe(false);
    expect(resolveCloudinaryBackupUploadOverride("f1_private_image")).toBe(
      false,
    );
    expect(
      resolveCloudinaryBackupUploadOverride("coaching_private_video"),
    ).toBe(false);
  });

  it("rejects placeholder policy and approval evidence", () => {
    const env = approvedPublicBackup();
    env.CLOUDINARY_BACKUP_POLICY_VERSION = "changeme";
    env.CLOUDINARY_BACKUP_APPROVAL_ID = "replace-me";

    expect(evaluateCloudinaryBackupPolicy(env)).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        "CLOUDINARY_BACKUP_POLICY_REQUIRED",
        "CLOUDINARY_BACKUP_APPROVAL_REQUIRED",
      ]),
    });
  });

  it("does not equate active deletion with backup-version purge", () => {
    expect(
      evaluateCloudinaryDeletionEvidence({ activeAssetDeleted: true }),
    ).toEqual({
      activeAssetDeleted: true,
      backupVersionPurged: false,
      lifecycleComplete: false,
    });
  });
});
