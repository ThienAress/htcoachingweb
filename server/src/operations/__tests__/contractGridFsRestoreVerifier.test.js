import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyContractGridFsSnapshot } from "../contractGridFsRestoreVerifier.js";
import { validateRestoreTarget } from "../../scripts/verifyContractGridFsRestore.js";

const FILE_ID = "64b000000000000000000001";
const pdf = Buffer.from("%PDF-1.7\nsynthetic restore canary\n%%EOF", "ascii");
const hash = crypto.createHash("sha256").update(pdf).digest("hex");

const fixture = () => ({
  contracts: [{ signedPdfFileId: FILE_ID, fileHash: hash }],
  files: [
    {
      _id: FILE_ID,
      length: pdf.length,
      chunkSize: 16,
      metadata: { contentType: "application/pdf" },
    },
  ],
  chunks: [
    { files_id: FILE_ID, n: 0, data: pdf.subarray(0, 16) },
    { files_id: FILE_ID, n: 1, data: pdf.subarray(16, 32) },
    { files_id: FILE_ID, n: 2, data: pdf.subarray(32) },
  ],
});

describe("contract GridFS restore verifier", () => {
  it("requires an explicitly isolated restore database", () => {
    expect(
      validateRestoreTarget({
        env: {
          RESTORE_VERIFY_MONGO_URI: "mongodb://localhost/htcoaching_restore_085",
          RESTORE_VERIFY_TARGET_DATABASE: "htcoaching_restore_085",
          RESTORE_VERIFY_PRODUCTION_DATABASE: "htcoaching",
          CONFIRM_ISOLATED_RESTORE: "yes",
        },
      }).valid,
    ).toBe(true);
    expect(
      validateRestoreTarget({
        env: {
          RESTORE_VERIFY_MONGO_URI: "mongodb://localhost/htcoaching",
          RESTORE_VERIFY_TARGET_DATABASE: "htcoaching",
          RESTORE_VERIFY_PRODUCTION_DATABASE: "htcoaching",
          CONFIRM_ISOLATED_RESTORE: "yes",
        },
      }).errors,
    ).toContain("RESTORE_VERIFY_ISOLATION_REQUIRED");
    expect(
      validateRestoreTarget({
        env: {
          RESTORE_VERIFY_MONGO_URI: "mongodb://localhost/htcoaching_copy",
          RESTORE_VERIFY_TARGET_DATABASE: "htcoaching_copy",
          RESTORE_VERIFY_PRODUCTION_DATABASE: "htcoaching",
          CONFIRM_ISOLATED_RESTORE: "yes",
        },
      }).errors,
    ).toContain("RESTORE_VERIFY_ISOLATION_REQUIRED");
  });

  it("accepts a complete PDF whose bytes match the signed contract hash", () => {
    expect(verifyContractGridFsSnapshot(fixture())).toEqual({
      success: true,
      signedContracts: 1,
      referencedFiles: 1,
      files: 1,
      chunks: 3,
      checkedBytes: pdf.length,
      findings: [],
    });
  });

  it("fails closed for missing files, orphan data and reused references", () => {
    const input = fixture();
    input.contracts.push({ signedPdfFileId: FILE_ID, fileHash: hash });
    input.contracts.push({ signedPdfFileId: "invalid", fileHash: hash });
    input.files.push({
      _id: "64b000000000000000000002",
      length: 1,
      chunkSize: 1,
      contentType: "application/pdf",
    });
    input.chunks.push({
      files_id: "64b000000000000000000003",
      n: 0,
      data: Buffer.from("x"),
    });

    const codes = verifyContractGridFsSnapshot(input).findings.map(
      ({ code }) => code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "CONTRACT_SIGNED_PDF_ID_INVALID",
        "GRIDFS_FILE_REFERENCE_REUSED",
        "GRIDFS_ORPHAN_CHUNK",
        "GRIDFS_ORPHAN_FILE",
      ]),
    );
  });

  it("detects chunk gaps, invalid PDF signatures and hash mismatches", () => {
    const badSequence = fixture();
    badSequence.chunks[1].n = 2;
    expect(
      verifyContractGridFsSnapshot(badSequence).findings.map(({ code }) => code),
    ).toContain("GRIDFS_CHUNK_SEQUENCE_INVALID");

    const badPdf = fixture();
    badPdf.chunks[0].data = Buffer.from("NOTPDFFORMAT1234", "ascii");
    const codes = verifyContractGridFsSnapshot(badPdf).findings.map(
      ({ code }) => code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "GRIDFS_PDF_SIGNATURE_INVALID",
        "GRIDFS_PDF_HASH_MISMATCH",
      ]),
    );
  });

  it("reports legacy producer-shaped PDFs without misclassifying valid bytes", () => {
    const legacy = fixture();
    delete legacy.files[0].metadata;
    legacy.files[0].contentType = "application/pdf";

    const result = verifyContractGridFsSnapshot(legacy);
    const codes = result.findings.map(
      ({ code }) => code,
    );
    expect(result.success).toBe(false);
    expect(codes).toContain("GRIDFS_PDF_CONTENT_TYPE_LEGACY_MISSING");
    expect(codes).not.toContain("GRIDFS_PDF_CONTENT_TYPE_INVALID");
    expect(codes).not.toContain("GRIDFS_PDF_SIGNATURE_INVALID");
    expect(codes).not.toContain("GRIDFS_PDF_HASH_MISMATCH");
  });

  it("does not let a legacy top-level content type override invalid canonical metadata", () => {
    const invalidMetadata = fixture();
    invalidMetadata.files[0].contentType = "application/pdf";
    invalidMetadata.files[0].metadata.contentType = "text/plain";

    const result = verifyContractGridFsSnapshot(invalidMetadata);

    expect(result.success).toBe(false);
    expect(result.findings.map(({ code }) => code)).toContain(
      "GRIDFS_PDF_CONTENT_TYPE_INVALID",
    );
  });
});
