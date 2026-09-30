import mongodb from "mongodb";

import { validateKnowledgeEntryPrivacy } from "../services/ai/knowledgePrivacy.js";
import { KNOWLEDGE_CATEGORIES, normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";
import {
  MAX_KB_DOCUMENTS,
  fingerprint,
} from "./stagingKnowledgeBaseSync.contract.js";
import {
  reviewImportError,
  reviewManifestDigest,
  sourceQuestionDigest,
  validateReviewManifest,
} from "./stagingKnowledgeBaseReviewImport.contract.js";

const { ObjectId } = mongodb;

const SOURCE_PROJECTION = {
  _id: 1,
  question: 1,
  category: 1,
  status: 1,
  reviewStatus: 1,
  source: 1,
  sources: 1,
  updatedAt: 1,
};

const TARGET_PROJECTION = {
  _id: 1,
  question: 1,
  normalizedQuestion: 1,
  answer: 1,
  category: 1,
  tags: 1,
  variants: 1,
  variantCount: 1,
  embedding: 1,
  embeddingStatus: 1,
  embeddingVersion: 1,
  embeddingError: 1,
  embeddingUpdatedAt: 1,
  sources: 1,
  evidenceLevel: 1,
  reviewStatus: 1,
  reviewedBy: 1,
  reviewedAt: 1,
  reviewDueAt: 1,
  freshnessClass: 1,
  revision: 1,
  source: 1,
  status: 1,
  usageCount: 1,
  lastUsedAt: 1,
  createdBy: 1,
};

const sourceIsConversationDerived = (entry) =>
  Boolean(
    entry?.source?.conversationId ||
      entry?.source?.questionHash ||
      entry?.source?.answerHash ||
      (entry?.sources || []).some((source) => source?.type === "conversation"),
  );

const loadEntries = async (db, projection, { session } = {}) => {
  const entries = await db
    .collection("knowledgeentries")
    .find({}, { projection, ...(session ? { session } : {}) })
    .sort({ _id: 1 })
    .limit(MAX_KB_DOCUMENTS + 1)
    .toArray();
  if (entries.length > MAX_KB_DOCUMENTS) {
    throw reviewImportError("KB_REVIEW_IMPORT_DOCUMENT_LIMIT_EXCEEDED");
  }
  return entries;
};

export const loadProductionReviewSourceEntries = (sourceDb) =>
  loadEntries(sourceDb, SOURCE_PROJECTION);

export const loadTargetReviewEntries = (targetDb, options) =>
  loadEntries(targetDb, TARGET_PROJECTION, options);

const comparableReviewEntry = (entry) => ({
  question: String(entry?.question || "").trim(),
  normalizedQuestion: String(entry?.normalizedQuestion || normalizeKnowledgeQuestion(entry?.question)),
  answer: String(entry?.answer || "").trim(),
  category: entry?.category || "general",
  tags: Array.isArray(entry?.tags) ? entry.tags.map(String) : [],
  variants: Array.isArray(entry?.variants)
    ? entry.variants.map((variant) => ({
        text: String(variant?.text || "").trim(),
        embedding: Array.isArray(variant?.embedding) ? variant.embedding : [],
      }))
    : [],
  variantCount: Number(entry?.variantCount) || 0,
  embedding: Array.isArray(entry?.embedding) ? entry.embedding : [],
  embeddingStatus: entry?.embeddingStatus || "pending",
  embeddingVersion: entry?.embeddingVersion || null,
  embeddingError: entry?.embeddingError || null,
  embeddingUpdatedAt: entry?.embeddingUpdatedAt || null,
  sources: Array.isArray(entry?.sources) ? entry.sources : [],
  evidenceLevel: entry?.evidenceLevel || "source_backed",
  reviewStatus: entry?.reviewStatus || "needs_review",
  reviewedBy: entry?.reviewedBy || null,
  reviewedAt: entry?.reviewedAt || null,
  reviewDueAt: entry?.reviewDueAt || null,
  freshnessClass: entry?.freshnessClass || "stable",
  revision: Math.max(Number(entry?.revision) || 1, 1),
  source: entry?.source || null,
  status: entry?.status || "draft",
  usageCount: Number(entry?.usageCount) || 0,
  lastUsedAt: entry?.lastUsedAt || null,
  createdBy: entry?.createdBy || null,
});

const buildPreparedEntry = ({ manifestDocument, sourceEntry, reviewerId }) => {
  const category = KNOWLEDGE_CATEGORIES.includes(sourceEntry.category)
    ? sourceEntry.category
    : null;
  if (!category) {
    throw reviewImportError("KB_REVIEW_IMPORT_SOURCE_CATEGORY_INVALID");
  }
  const prepared = {
    question: manifestDocument.proposedQuestion,
    normalizedQuestion: normalizeKnowledgeQuestion(manifestDocument.proposedQuestion),
    answer: manifestDocument.proposedAnswer,
    category,
    tags: [],
    variants: [],
    variantCount: 0,
    embedding: [],
    embeddingStatus: "pending",
    embeddingVersion: null,
    embeddingError: null,
    embeddingUpdatedAt: null,
    sources: manifestDocument.sources,
    evidenceLevel: "source_backed",
    reviewStatus: "needs_review",
    reviewedBy: null,
    reviewedAt: null,
    reviewDueAt: null,
    freshnessClass: "stable",
    revision: 1,
    source: null,
    status: "draft",
    usageCount: 0,
    lastUsedAt: null,
    createdBy: reviewerId,
  };
  const privacy = validateKnowledgeEntryPrivacy(prepared);
  if (!privacy.valid) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_PRIVACY_REJECTED",
      `${manifestDocument.sourceId}: ${privacy.reason || "rejected"}`,
    );
  }
  return prepared;
};

const assertTargetConflicts = (targetEntries, operations) => {
  const targetById = new Map(
    (targetEntries || []).map((target) => [String(target?._id), target]),
  );
  const targetByQuestion = new Map();
  for (const target of targetEntries || []) {
    const normalized = String(target?.normalizedQuestion || "").trim();
    if (normalized) targetByQuestion.set(normalized, target);
  }
  for (const operation of operations) {
    const targetBySourceId = targetById.get(operation.sourceId);
    if (
      targetBySourceId &&
      String(targetBySourceId.normalizedQuestion || "") !== operation.normalizedQuestion
    ) {
      throw reviewImportError("KB_REVIEW_IMPORT_TARGET_ID_CONFLICT");
    }
    const current = targetByQuestion.get(operation.normalizedQuestion);
    if (current && String(current._id) !== operation.sourceId) {
      throw reviewImportError("KB_REVIEW_IMPORT_TARGET_QUESTION_CONFLICT");
    }
  }
};

export const buildReviewImportPlan = ({
  manifest,
  sourceEntries = [],
  targetEntries = [],
  reviewerId,
  now = new Date(),
} = {}) => {
  if (!reviewerId || !ObjectId.isValid(reviewerId)) {
    throw reviewImportError("KB_REVIEW_IMPORT_REVIEWER_INVALID");
  }
  const validatedManifest = validateReviewManifest(manifest);
  const sourceById = new Map(sourceEntries.map((entry) => [String(entry?._id), entry]));
  const targetById = new Map(targetEntries.map((entry) => [String(entry?._id), entry]));
  const operations = [];
  const normalizedQuestions = new Set();

  for (const manifestDocument of validatedManifest.documents) {
    const source = sourceById.get(manifestDocument.sourceId);
    if (!source) {
      throw reviewImportError("KB_REVIEW_IMPORT_SOURCE_NOT_FOUND", manifestDocument.sourceId);
    }
    if (sourceQuestionDigest(source.question) !== manifestDocument.sourceQuestionDigest) {
      throw reviewImportError("KB_REVIEW_IMPORT_SOURCE_QUESTION_DRIFT", manifestDocument.sourceId);
    }
    if (source.status === "archived") {
      throw reviewImportError("KB_REVIEW_IMPORT_SOURCE_ARCHIVED", manifestDocument.sourceId);
    }
    if (sourceIsConversationDerived(source)) {
      throw reviewImportError("KB_REVIEW_IMPORT_CONVERSATION_SOURCE", manifestDocument.sourceId);
    }
    const target = targetById.get(manifestDocument.sourceId) || null;
    const update = buildPreparedEntry({
      manifestDocument,
      sourceEntry: source,
      reviewerId,
    });
    if (target) {
      update.createdBy = target.createdBy || reviewerId;
      update.usageCount = Number(target.usageCount) || 0;
      update.lastUsedAt = target.lastUsedAt || null;
      update.revision = Math.max(Number(target.revision) || 1, update.revision);
    }
    if (normalizedQuestions.has(update.normalizedQuestion)) {
      throw reviewImportError("KB_REVIEW_IMPORT_DUPLICATE_PROPOSED_QUESTION");
    }
    normalizedQuestions.add(update.normalizedQuestion);
    operations.push({
      type: target ? "update" : "insert",
      sourceId: manifestDocument.sourceId,
      targetId: target?._id ? String(target._id) : null,
      normalizedQuestion: update.normalizedQuestion,
      sourceQuestionDigest: manifestDocument.sourceQuestionDigest,
      expectedFingerprint: fingerprint(comparableReviewEntry(update)),
      targetFingerprint: target ? fingerprint(comparableReviewEntry(target)) : null,
      update,
      sourceUpdatedAt: source.updatedAt || null,
    });
  }

  assertTargetConflicts(targetEntries, operations);
  const changed = operations.filter(
    (operation) => operation.expectedFingerprint !== operation.targetFingerprint,
  );
  const unchanged = operations.length - changed.length;
  const manifestDigest = reviewManifestDigest(validatedManifest);
  const digestPayload = {
    version: 1,
    manifestDigest,
    reviewerId: String(reviewerId),
    operations: operations.map((operation) => ({
      type: operation.type,
      sourceId: operation.sourceId,
      normalizedQuestion: operation.normalizedQuestion,
      sourceQuestionDigest: operation.sourceQuestionDigest,
      expectedFingerprint: operation.expectedFingerprint,
      targetFingerprint: operation.targetFingerprint,
    })),
  };
  return {
    planDigest: fingerprint(digestPayload),
    manifestDigest,
    digestPayload,
    operations: changed,
    summary: {
      sourceDocuments: sourceEntries.length,
      manifestDocuments: validatedManifest.documents.length,
      eligibleDocuments: operations.length,
      skippedDocuments: 0,
      skippedByReason: {},
      targetDocuments: targetEntries.length,
      inserts: changed.filter((operation) => operation.type === "insert").length,
      updates: changed.filter((operation) => operation.type === "update").length,
      unchanged,
      embeddingReady: 0,
      embeddingPending: operations.length,
      privacyValidated: operations.length,
      generatedAt: now.toISOString(),
    },
  };
};

const assertTargetPlanState = async (targetDb, plan, options) => {
  const targetEntries = await loadTargetReviewEntries(targetDb, options);
  const currentById = new Map(targetEntries.map((entry) => [String(entry._id), entry]));
  assertTargetConflicts(targetEntries, plan.operations);
  for (const operation of plan.operations) {
    const current = currentById.get(operation.sourceId);
    const currentFingerprint = current ? fingerprint(comparableReviewEntry(current)) : null;
    if (currentFingerprint !== operation.targetFingerprint) {
      throw reviewImportError("KB_REVIEW_IMPORT_TARGET_DRIFT");
    }
  }
};

const assertTargetPostWriteState = (targetEntries, plan) => {
  const targetById = new Map(targetEntries.map((entry) => [String(entry._id), entry]));
  const failed = plan.operations.filter((operation) => {
    const current = targetById.get(operation.sourceId);
    return !current || fingerprint(comparableReviewEntry(current)) !== operation.expectedFingerprint;
  });
  if (failed.length) {
    throw reviewImportError("KB_REVIEW_IMPORT_POST_VERIFY_FAILED");
  }
};

export const applyReviewImportPlan = async ({ targetDb, targetClient, plan }) => {
  if (!targetClient?.startSession) {
    throw reviewImportError("KB_REVIEW_IMPORT_TRANSACTION_REQUIRED");
  }
  const session = targetClient.startSession();
  try {
    return await session.withTransaction(
      async () => {
        await assertTargetPlanState(targetDb, plan, { session });
        let written = 0;
        for (const operation of plan.operations) {
          const result = await targetDb.collection("knowledgeentries").updateOne(
            { _id: new ObjectId(operation.sourceId) },
            {
              $set: {
                ...operation.update,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, session },
          );
          if (result.matchedCount !== 1 && result.upsertedCount !== 1) {
            throw reviewImportError("KB_REVIEW_IMPORT_WRITE_FAILED");
          }
          written += 1;
        }
        const targetEntries = await loadTargetReviewEntries(targetDb, { session });
        assertTargetPostWriteState(targetEntries, plan);
        return { documentsWritten: written };
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
};

export const verifyReviewImportPostState = async ({ targetDb, plan }) => {
  const targetEntries = await loadTargetReviewEntries(targetDb);
  assertTargetPostWriteState(targetEntries, plan);
  return {
    verifiedDocuments: plan.operations.length,
    targetDocuments: targetEntries.length,
    publishedDocuments: targetEntries.filter((entry) => entry.status === "published").length,
  };
};

export { assertProductionKnowledgeSourceReadOnly } from "./stagingKnowledgeBaseSync.runtime.js";
export { resolveStagingReviewer } from "./stagingKnowledgeBaseSync.runtime.js";
