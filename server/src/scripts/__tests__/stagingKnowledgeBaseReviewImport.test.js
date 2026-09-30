import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

import {
  reviewManifestDigest,
  sourceQuestionDigest,
  validateReviewManifest,
  validateStagingKnowledgeBaseReviewImportAuthorization,
} from "../stagingKnowledgeBaseReviewImport.contract.js";
import { buildReviewImportPlan } from "../stagingKnowledgeBaseReviewImport.runtime.js";

const reviewerId = new ObjectId("507f1f77bcf86cd799439011");
const baseEnv = {
  APP_ENV: "staging",
  MONGO_URI: "mongodb://target.example/htcoaching_staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  PRODUCTION_KB_READONLY_URI: "mongodb://source.example/gym-app",
  STAGING_KB_SOURCE_ENV: "production",
  STAGING_KB_SOURCE_READ_ONLY: "yes",
  STAGING_KB_SYNC_REVIEWER_EMAIL: "admin@example.com",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  CONFIRM_STAGING_KB_REVIEW_IMPORT: "yes",
};

const safeSource = {
  type: "research",
  title: "Review source",
  publisher: "Research publisher",
  url: "https://example.com/research",
  publishedAt: null,
  retrievedAt: null,
  evidenceTier: "primary",
};

const makeFixture = () => {
  const documents = Array.from({ length: 28 }, (_, index) => {
    const sourceId = `507f1f77bcf86cd7${String(index).padStart(8, "0")}`;
    const originalQuestion = `Original question ${index}`;
    return {
      manifestEntryNumber: index + 1,
      sourceId,
      sourceQuestionDigest: sourceQuestionDigest(originalQuestion),
      proposedQuestion: `Reviewed question ${index}`,
      proposedAnswer: `Safe reviewed answer ${index}.`,
      sources: [safeSource],
    };
  });
  return {
    manifestVersion: 1,
    manifestId: "test-manifest",
    documents,
  };
};

describe("staging Knowledge Base review import", () => {
  it("validates the checked-in 28-entry manifest without raw proposal fields", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../stagingKnowledgeBaseReviewManifest.json", import.meta.url), "utf8"),
    );
    const validated = validateReviewManifest(manifest);
    expect(validated.documents).toHaveLength(28);
    expect(reviewManifestDigest(manifest)).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(manifest)).not.toContain("originalAnswer");
    expect(JSON.stringify(manifest)).not.toContain("originalQuestion");
  });

  it("requires the review import confirmation and digest only for apply", () => {
    expect(() => validateStagingKnowledgeBaseReviewImportAuthorization({
      argv: ["--target=staging"],
      env: baseEnv,
    })).not.toThrow();
    expect(() => validateStagingKnowledgeBaseReviewImportAuthorization({
      argv: ["--target=staging", "--apply", "--confirm-staging-kb-review-import"],
      env: baseEnv,
    })).toThrowError(/KB_REVIEW_IMPORT_PLAN_DIGEST_REQUIRED/);
  });

  it("plans only draft and needs_review entries, without deletions", () => {
    const manifest = makeFixture();
    const sourceEntries = manifest.documents.map((document, index) => ({
      _id: new ObjectId(document.sourceId),
      question: `Original question ${index}`,
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
      source: null,
      sources: [],
    }));
    const plan = buildReviewImportPlan({
      manifest,
      sourceEntries,
      targetEntries: [],
      reviewerId,
      now: new Date("2026-09-30T00:00:00.000Z"),
    });
    expect(plan.summary.manifestDocuments).toBe(28);
    expect(plan.summary.inserts).toBe(28);
    expect(plan.summary.updates).toBe(0);
    expect(plan.operations.every((operation) => operation.update.status === "draft")).toBe(true);
    expect(plan.operations.every((operation) => operation.update.reviewStatus === "needs_review")).toBe(true);
  });

  it("rejects a target question collision owned by another document", () => {
    const manifest = makeFixture();
    const sourceEntries = manifest.documents.map((document, index) => ({
      _id: new ObjectId(document.sourceId),
      question: `Original question ${index}`,
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
      source: null,
      sources: [],
    }));
    const targetEntries = [{
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      normalizedQuestion: "reviewed question 0",
      question: "Reviewed question 0",
      answer: "other",
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
    }];
    expect(() => buildReviewImportPlan({
      manifest,
      sourceEntries,
      targetEntries,
      reviewerId,
    })).toThrowError(/KB_REVIEW_IMPORT_TARGET_QUESTION_CONFLICT/);
  });

  it("rejects overwriting a staging document that reuses a source id", () => {
    const manifest = makeFixture();
    const sourceEntries = manifest.documents.map((document, index) => ({
      _id: new ObjectId(document.sourceId),
      question: `Original question ${index}`,
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
      source: null,
      sources: [],
    }));
    const targetEntries = [{
      _id: new ObjectId(manifest.documents[0].sourceId),
      normalizedQuestion: "unrelated staging document",
    }];
    expect(() => buildReviewImportPlan({
      manifest,
      sourceEntries,
      targetEntries,
      reviewerId,
    })).toThrowError(/KB_REVIEW_IMPORT_TARGET_ID_CONFLICT/);
  });

  it("preserves existing staging usage metadata during a content update", () => {
    const manifest = makeFixture();
    const sourceEntries = manifest.documents.map((document, index) => ({
      _id: new ObjectId(document.sourceId),
      question: `Original question ${index}`,
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
      source: null,
      sources: [],
    }));
    const targetEntries = [{
      _id: new ObjectId(manifest.documents[0].sourceId),
      normalizedQuestion: "reviewed question 0",
      question: "Reviewed question 0",
      answer: "old answer",
      category: "training",
      status: "draft",
      reviewStatus: "needs_review",
      usageCount: 7,
      lastUsedAt: "2026-09-29T00:00:00.000Z",
      revision: 4,
      createdBy: new ObjectId("507f1f77bcf86cd799439099"),
    }];
    const plan = buildReviewImportPlan({
      manifest,
      sourceEntries,
      targetEntries,
      reviewerId,
    });
    const operation = plan.operations.find(({ sourceId }) => sourceId === manifest.documents[0].sourceId);
    expect(operation.update.usageCount).toBe(7);
    expect(operation.update.revision).toBe(4);
    expect(String(operation.update.createdBy)).toBe("507f1f77bcf86cd799439099");
  });
});
