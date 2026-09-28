import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
} from "../../services/ai/embeddingProfile.js";
import {
  prepareKnowledgeEntry,
  validateStagingKnowledgeBaseSyncAuthorization,
} from "../stagingKnowledgeBaseSync.contract.js";
import {
  buildKnowledgeSyncPlan,
  assertProductionKnowledgeSourceReadOnly,
} from "../stagingKnowledgeBaseSync.runtime.js";

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
  CONFIRM_STAGING_KB_SYNC: "yes",
};

const entry = (overrides = {}) => ({
  _id: new ObjectId("507f1f77bcf86cd799439012"),
  question: "Kỹ thuật squat cơ bản là gì?",
  normalizedQuestion: "kỹ thuật squat cơ bản là gì?",
  answer: "Giữ lưng trung lập và kiểm soát biên độ.",
  category: "training",
  tags: ["squat"],
  variants: [],
  embedding: [],
  embeddingStatus: "pending",
  embeddingVersion: null,
  embeddingUpdatedAt: null,
  sources: [{
    type: "professional",
    title: "NSCA squat guide",
    publisher: "NSCA",
    url: "https://www.nsca.com/education/articles/kinetic-select/squat/",
    evidenceTier: "professional",
    publishedAt: null,
    retrievedAt: "2026-09-29T00:00:00.000Z",
  }],
  evidenceLevel: "source_backed",
  reviewStatus: "reviewed",
  reviewedBy: new ObjectId("507f1f77bcf86cd799439013"),
  reviewedAt: "2026-09-28T00:00:00.000Z",
  reviewDueAt: "2027-09-28T00:00:00.000Z",
  freshnessClass: "stable",
  revision: 2,
  source: null,
  status: "published",
  ...overrides,
});

describe("staging Knowledge Base production sync", () => {
  it("requires the production read-only source and staging target", () => {
    expect(() => validateStagingKnowledgeBaseSyncAuthorization({
      argv: ["--target=staging"],
      env: baseEnv,
    })).not.toThrow();
    expect(() => validateStagingKnowledgeBaseSyncAuthorization({
      argv: ["--target=staging"],
      env: { ...baseEnv, PRODUCTION_KB_READONLY_URI: "mongodb://source.example/htcoaching_staging" },
    })).toThrowError(/KB_SYNC_PRODUCTION_DATABASE_REQUIRED/);
  });

  it("requires a reviewed digest before apply", () => {
    expect(() => validateStagingKnowledgeBaseSyncAuthorization({
      argv: ["--target=staging", "--apply", "--confirm-staging-kb-sync"],
      env: baseEnv,
    })).toThrowError(/KB_SYNC_PLAN_DIGEST_REQUIRED/);
  });

  it("excludes unpublished and conversation-derived entries", () => {
    expect(prepareKnowledgeEntry(entry(), { reviewerId }).value).toBeTruthy();
    expect(prepareKnowledgeEntry(entry({ status: "draft" }), { reviewerId }).skip)
      .toBe("KB_SYNC_NOT_PUBLISHED");
    expect(prepareKnowledgeEntry(entry({ source: { conversationId: new ObjectId() } }), { reviewerId }).skip)
      .toBe("KB_SYNC_CONVERSATION_SOURCE");
  });

  it("keeps current vectors and marks incompatible vectors pending", () => {
    const prepared = prepareKnowledgeEntry(entry({
      embedding: Array.from({ length: 768 }, () => 0.1),
      embeddingStatus: "pending",
      embeddingVersion: "old-version",
    }), { reviewerId });
    expect(prepared.value.embeddingStatus).toBe("pending");
    expect(prepared.value.embedding).toEqual([]);

    const current = prepareKnowledgeEntry(entry({
      embedding: Array.from({ length: EMBEDDING_DIMENSION }, () => 0.1),
      embeddingStatus: "ready",
      embeddingVersion: EMBEDDING_VERSION,
    }), { reviewerId });
    expect(current.value.embeddingStatus).toBe("ready");
    expect(current.value.embedding).toHaveLength(EMBEDDING_DIMENSION);
  });

  it("builds a deterministic insert plan without deleting staging-only entries", () => {
    const plan = buildKnowledgeSyncPlan({
      sourceEntries: [entry()],
      targetEntries: [{
        _id: new ObjectId("507f1f77bcf86cd799439014"),
        normalizedQuestion: "staging-only",
      }],
      reviewerId,
      now: new Date("2026-09-29T00:00:00.000Z"),
    });
    expect(plan.summary.inserts).toBe(1);
    expect(plan.summary.targetDocuments).toBe(1);
    expect(plan.operations).toHaveLength(1);
    expect(plan.planDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a source role that is not exactly read on gym-app", async () => {
    await expect(assertProductionKnowledgeSourceReadOnly({
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: [{ role: "readWrite", db: "gym-app" }],
          authenticatedUserPrivileges: [],
        },
      }),
    })).rejects.toThrowError(/KB_SYNC_SOURCE_READ_ONLY_ROLE_REQUIRED/);
  });
});

