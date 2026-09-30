import crypto from "node:crypto";
import mongodb from "mongodb";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { validateStagingEnvironment } from "../config/stagingSafety.js";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
} from "../services/ai/embeddingProfile.js";
import { validateKnowledgeEntryPrivacy } from "../services/ai/knowledgePrivacy.js";
import {
  normalizeKnowledgeQuestion,
  validateKnowledgePublication,
} from "../utils/knowledgeBase.js";

const { EJSON } = mongodb.BSON;

export const PRODUCTION_KB_DATABASE = "gym-app";
export const STAGING_KB_DATABASE = "htcoaching_staging";
export const STAGING_KB_SYNC_CONFIRMATION = "CONFIRM_STAGING_KB_SYNC";
export const STAGING_KB_SYNC_DIGEST_VARIABLE =
  "STAGING_KB_SYNC_EXPECTED_PLAN_DIGEST";
export const MAX_KB_DOCUMENTS = 5000;

const DIGEST_ARGUMENT = "--expected-plan-digest=";

const databaseName = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

const readExpectedDigest = (argv, env) => {
  const cli = argv
    .filter((argument) => argument.startsWith(DIGEST_ARGUMENT))
    .map((argument) => argument.slice(DIGEST_ARGUMENT.length).trim().toLowerCase());
  const fromEnv = String(env[STAGING_KB_SYNC_DIGEST_VARIABLE] || "")
    .trim()
    .toLowerCase();
  const supplied = [...cli, ...(fromEnv ? [fromEnv] : [])];
  if (supplied.length === 0) throw syncError("KB_SYNC_PLAN_DIGEST_REQUIRED");
  if (supplied.some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
    throw syncError("KB_SYNC_PLAN_DIGEST_INVALID");
  }
  if (new Set(supplied).size !== 1) {
    throw syncError("KB_SYNC_PLAN_DIGEST_CONFLICT");
  }
  return supplied[0];
};

export const syncError = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

export const validateStagingKnowledgeBaseSyncAuthorization = ({
  argv = [],
  env = process.env,
} = {}) => {
  const args = new Set(argv);
  const target = argv
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (target !== "staging") throw syncError("KB_SYNC_TARGET_REQUIRED");

  const sourceUri = env.PRODUCTION_KB_READONLY_URI;
  if (String(env.STAGING_KB_SOURCE_ENV || "").toLowerCase() !== "production") {
    throw syncError("KB_SYNC_PRODUCTION_SOURCE_REQUIRED");
  }
  if (String(env.STAGING_KB_SOURCE_READ_ONLY || "").toLowerCase() !== "yes") {
    throw syncError("KB_SYNC_READ_ONLY_SOURCE_REQUIRED");
  }
  if (databaseName(sourceUri) !== PRODUCTION_KB_DATABASE) {
    throw syncError("KB_SYNC_PRODUCTION_DATABASE_REQUIRED");
  }
  if (databaseName(env.MONGO_URI) !== STAGING_KB_DATABASE) {
    throw syncError("KB_SYNC_STAGING_DATABASE_REQUIRED");
  }
  if (String(env.MIGRATION_TARGET_DATABASE || "") !== STAGING_KB_DATABASE) {
    throw syncError("KB_SYNC_TARGET_DATABASE_REQUIRED");
  }
  const staging = validateStagingEnvironment(env);
  if (!staging.valid) {
    throw syncError(
      "KB_SYNC_STAGING_ENVIRONMENT_REJECTED",
      staging.errors.map(({ code }) => code).join(", "),
    );
  }

  const apply = args.has("--apply");
  let expectedPlanDigest = "";
  if (apply) {
    if (!args.has("--confirm-staging-kb-sync")) {
      throw syncError("KB_SYNC_CONFIRMATION_REQUIRED");
    }
    assertStagingOperation({
      env,
      confirmationVariable: STAGING_KB_SYNC_CONFIRMATION,
    });
    expectedPlanDigest = readExpectedDigest(argv, env);
  }
  return {
    target,
    apply,
    expectedPlanDigest,
    sourceDatabase: PRODUCTION_KB_DATABASE,
    targetDatabase: STAGING_KB_DATABASE,
  };
};

export const canonicalize = (value) => {
  const serialized = EJSON.serialize(value, { relaxed: false });
  if (Array.isArray(serialized)) return serialized.map(canonicalize);
  if (!serialized || typeof serialized !== "object") return serialized;
  return Object.fromEntries(
    Object.keys(serialized)
      .sort()
      .map((key) => [key, canonicalize(serialized[key])]),
  );
};

export const fingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");

const validVector = (value) =>
  Array.isArray(value) &&
  value.length === EMBEDDING_DIMENSION &&
  value.every((item) => Number.isFinite(item));

const sourceIsConversationDerived = (entry) =>
  Boolean(
    entry?.source?.conversationId ||
      entry?.source?.questionHash ||
      entry?.source?.answerHash ||
      (entry?.sources || []).some((source) => source?.type === "conversation"),
  );

const cleanVariant = (variant) => ({
  text: String(variant?.text || "").trim(),
  embedding: validVector(variant?.embedding) ? variant.embedding : [],
});

const cleanSource = (source) => {
  if (
    !source ||
    typeof source !== "object" ||
    !source.type ||
    !source.title ||
    !source.publisher ||
    !source.evidenceTier
  ) return null;
  return {
    type: source.type,
    title: source.title,
    publisher: source.publisher,
    url: source.url || null,
    publishedAt: source.publishedAt || null,
    retrievedAt: source.retrievedAt || null,
    evidenceTier: source.evidenceTier,
  };
};

export const prepareKnowledgeEntry = (entry, { reviewerId, now = new Date() } = {}) => {
  if (!entry || !reviewerId) return { skip: "KB_SYNC_INVALID_ENTRY" };
  if (entry.status !== "published") return { skip: "KB_SYNC_NOT_PUBLISHED" };
  if (sourceIsConversationDerived(entry)) return { skip: "KB_SYNC_CONVERSATION_SOURCE" };
  if (entry.reviewStatus !== "reviewed" || !entry.reviewedBy || !entry.reviewedAt) {
    return { skip: "KB_SYNC_NOT_REVIEWED" };
  }
  const privacy = validateKnowledgeEntryPrivacy(entry);
  if (!privacy.valid) {
    return { skip: `KB_SYNC_PRIVACY_${privacy.reason || "REJECTED"}` };
  }
  const publication = validateKnowledgePublication(entry, { now });
  if (!publication.valid) return { skip: publication.code };

  const normalizedQuestion = normalizeKnowledgeQuestion(entry.question);
  if (!normalizedQuestion || !String(entry.answer || "").trim()) {
    return { skip: "KB_SYNC_CONTENT_INVALID" };
  }
  const variants = (Array.isArray(entry.variants) ? entry.variants : [])
    .map(cleanVariant)
    .filter((variant) => variant.text);
  const hasRootVector =
    entry.embeddingStatus === "ready" &&
    entry.embeddingVersion === EMBEDDING_VERSION &&
    validVector(entry.embedding);
  const hasCompleteVariants = variants.every(
    (variant) => !variant.embedding.length || hasRootVector,
  );
  const ready = hasRootVector && hasCompleteVariants;
  const prepared = {
    question: String(entry.question).trim(),
    normalizedQuestion,
    answer: String(entry.answer).trim(),
    category: entry.category,
    tags: Array.isArray(entry.tags) ? entry.tags.map(String).slice(0, 20) : [],
    variants,
    variantCount: variants.length,
    embedding: ready ? entry.embedding : [],
    embeddingStatus: ready ? "ready" : "pending",
    embeddingVersion: ready ? EMBEDDING_VERSION : null,
    embeddingError: null,
    embeddingUpdatedAt: ready ? entry.embeddingUpdatedAt || now : null,
    sources: (Array.isArray(entry.sources) ? entry.sources : [])
      .map(cleanSource)
      .filter(Boolean),
    evidenceLevel: entry.evidenceLevel,
    reviewStatus: "reviewed",
    freshnessClass: entry.freshnessClass,
    reviewedBy: reviewerId,
    reviewedAt: entry.reviewedAt,
    reviewDueAt: entry.reviewDueAt || null,
    revision: Math.max(Number(entry.revision) || 1, 1),
    source: null,
    status: "published",
    usageCount: 0,
    lastUsedAt: null,
    createdBy: reviewerId,
  };
  return {
    value: prepared,
    sourceId: String(entry._id),
    sourceUpdatedAt: entry.updatedAt || null,
    sourceEmbeddingVersion: entry.embeddingVersion || null,
    ready,
  };
};

export const summarizeSkips = (skips = []) =>
  skips.reduce((counts, code) => ({
    ...counts,
    [code]: (counts[code] || 0) + 1,
  }), {});

