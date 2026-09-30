import crypto from "node:crypto";
import mongodb from "mongodb";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { validateStagingEnvironment } from "../config/stagingSafety.js";
import { validateKnowledgeEntryPrivacy } from "../services/ai/knowledgePrivacy.js";
import {
  KNOWLEDGE_EVIDENCE_TIERS,
  KNOWLEDGE_SOURCE_TYPES,
  MAX_KNOWLEDGE_SOURCES,
  hasKnowledgeSourceCredentialParameters,
  normalizeKnowledgeQuestion,
} from "../utils/knowledgeBase.js";
import { fingerprint } from "./stagingKnowledgeBaseSync.contract.js";

const { ObjectId } = mongodb;

export const REVIEW_MANIFEST_VERSION = 1;
export const EXPECTED_REVIEW_DOCUMENTS = 28;
export const PRODUCTION_KB_DATABASE = "gym-app";
export const STAGING_KB_DATABASE = "htcoaching_staging";
export const REVIEW_IMPORT_CONFIRMATION =
  "CONFIRM_STAGING_KB_REVIEW_IMPORT";
export const REVIEW_IMPORT_DIGEST_VARIABLE =
  "STAGING_KB_REVIEW_IMPORT_EXPECTED_PLAN_DIGEST";

const DIGEST_ARGUMENT = "--expected-plan-digest=";
const EXTERNAL_SOURCE_TYPES = new Set([
  "official",
  "research",
  "professional",
  "editorial",
]);

export const reviewImportError = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

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
  const fromEnv = String(env[REVIEW_IMPORT_DIGEST_VARIABLE] || "")
    .trim()
    .toLowerCase();
  const supplied = [...cli, ...(fromEnv ? [fromEnv] : [])];
  if (supplied.length === 0) {
    throw reviewImportError("KB_REVIEW_IMPORT_PLAN_DIGEST_REQUIRED");
  }
  if (supplied.some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
    throw reviewImportError("KB_REVIEW_IMPORT_PLAN_DIGEST_INVALID");
  }
  if (new Set(supplied).size !== 1) {
    throw reviewImportError("KB_REVIEW_IMPORT_PLAN_DIGEST_CONFLICT");
  }
  return supplied[0];
};

export const validateStagingKnowledgeBaseReviewImportAuthorization = ({
  argv = [],
  env = process.env,
} = {}) => {
  const args = new Set(argv);
  const target = argv
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (target !== "staging") {
    throw reviewImportError("KB_REVIEW_IMPORT_TARGET_REQUIRED");
  }
  if (String(env.STAGING_KB_SOURCE_ENV || "").toLowerCase() !== "production") {
    throw reviewImportError("KB_REVIEW_IMPORT_PRODUCTION_SOURCE_REQUIRED");
  }
  if (String(env.STAGING_KB_SOURCE_READ_ONLY || "").toLowerCase() !== "yes") {
    throw reviewImportError("KB_REVIEW_IMPORT_READ_ONLY_SOURCE_REQUIRED");
  }
  if (databaseName(env.PRODUCTION_KB_READONLY_URI) !== PRODUCTION_KB_DATABASE) {
    throw reviewImportError("KB_REVIEW_IMPORT_PRODUCTION_DATABASE_REQUIRED");
  }
  if (databaseName(env.MONGO_URI) !== STAGING_KB_DATABASE) {
    throw reviewImportError("KB_REVIEW_IMPORT_STAGING_DATABASE_REQUIRED");
  }
  if (String(env.MIGRATION_TARGET_DATABASE || "") !== STAGING_KB_DATABASE) {
    throw reviewImportError("KB_REVIEW_IMPORT_TARGET_DATABASE_REQUIRED");
  }
  const staging = validateStagingEnvironment(env);
  if (!staging.valid) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_STAGING_ENVIRONMENT_REJECTED",
      staging.errors.map(({ code }) => code).join(", "),
    );
  }

  const apply = args.has("--apply");
  let expectedPlanDigest = "";
  if (apply) {
    if (!args.has("--confirm-staging-kb-review-import")) {
      throw reviewImportError("KB_REVIEW_IMPORT_CONFIRMATION_REQUIRED");
    }
    assertStagingOperation({
      env,
      confirmationVariable: REVIEW_IMPORT_CONFIRMATION,
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

const requireString = (value, field, maxLength) => {
  if (typeof value !== "string" || !value.trim()) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `${field} required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `${field} too long`);
  }
  return trimmed;
};

const validateSource = (source, index) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `sources[${index}] invalid`);
  }
  const allowed = new Set([
    "type",
    "title",
    "publisher",
    "url",
    "publishedAt",
    "retrievedAt",
    "evidenceTier",
  ]);
  const unknown = Object.keys(source).find((key) => !allowed.has(key));
  if (unknown) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_MANIFEST_INVALID",
      `sources[${index}].${unknown} not allowed`,
    );
  }
  if (!EXTERNAL_SOURCE_TYPES.has(source.type) || !KNOWLEDGE_SOURCE_TYPES.includes(source.type)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `sources[${index}].type invalid`);
  }
  if (!KNOWLEDGE_EVIDENCE_TIERS.includes(source.evidenceTier)) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_MANIFEST_INVALID",
      `sources[${index}].evidenceTier invalid`,
    );
  }
  const title = requireString(source.title, `sources[${index}].title`, 300);
  const publisher = requireString(source.publisher, `sources[${index}].publisher`, 200);
  const url = requireString(source.url, `sources[${index}].url`, 2048);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `sources[${index}].url invalid`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || hasKnowledgeSourceCredentialParameters(parsed)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `sources[${index}].url unsafe`);
  }
  return {
    type: source.type,
    title,
    publisher,
    url: parsed.toString(),
    publishedAt: source.publishedAt ?? null,
    retrievedAt: source.retrievedAt ?? null,
    evidenceTier: source.evidenceTier,
  };
};

export const sourceQuestionDigest = (question) =>
  crypto
    .createHash("sha256")
    .update(normalizeKnowledgeQuestion(question))
    .digest("hex");

const validateManifestDocument = (document, index) => {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `documents[${index}] invalid`);
  }
  const allowed = new Set([
    "manifestEntryNumber",
    "sourceId",
    "sourceQuestionDigest",
    "proposedQuestion",
    "proposedAnswer",
    "sources",
  ]);
  const unknown = Object.keys(document).find((key) => !allowed.has(key));
  if (unknown) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_MANIFEST_INVALID",
      `documents[${index}].${unknown} not allowed`,
    );
  }
  if (!ObjectId.isValid(document.sourceId)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `documents[${index}].sourceId invalid`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(document.sourceQuestionDigest || ""))) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `documents[${index}].sourceQuestionDigest invalid`);
  }
  if (!Number.isInteger(document.manifestEntryNumber) || document.manifestEntryNumber < 1) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `documents[${index}].manifestEntryNumber invalid`);
  }
  const proposedQuestion = requireString(document.proposedQuestion, `documents[${index}].proposedQuestion`, 500);
  const proposedAnswer = requireString(document.proposedAnswer, `documents[${index}].proposedAnswer`, 5000);
  if (!Array.isArray(document.sources) || document.sources.length === 0 || document.sources.length > MAX_KNOWLEDGE_SOURCES) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID", `documents[${index}].sources invalid`);
  }
  const sources = document.sources.map(validateSource);
  const privacy = validateKnowledgeEntryPrivacy({
    question: proposedQuestion,
    answer: proposedAnswer,
    sources,
    source: null,
  });
  if (!privacy.valid) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_PRIVACY_REJECTED",
      `documents[${index}]: ${privacy.reason || "rejected"}`,
    );
  }
  return {
    manifestEntryNumber: Number(document.manifestEntryNumber) || index + 1,
    sourceId: String(new ObjectId(document.sourceId)),
    sourceQuestionDigest: String(document.sourceQuestionDigest),
    proposedQuestion,
    proposedAnswer,
    sources,
  };
};

export const validateReviewManifest = (manifest) => {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_INVALID");
  }
  if (manifest.manifestVersion !== REVIEW_MANIFEST_VERSION) {
    throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_VERSION_INVALID");
  }
  const manifestId = requireString(manifest.manifestId, "manifestId", 120);
  if (!Array.isArray(manifest.documents) || manifest.documents.length !== EXPECTED_REVIEW_DOCUMENTS) {
    throw reviewImportError(
      "KB_REVIEW_IMPORT_MANIFEST_COUNT_INVALID",
      `expected ${EXPECTED_REVIEW_DOCUMENTS} documents`,
    );
  }
  const documents = manifest.documents.map(validateManifestDocument);
  const sourceIds = new Set();
  const entryNumbers = new Set();
  for (const document of documents) {
    if (sourceIds.has(document.sourceId)) {
      throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_DUPLICATE_SOURCE");
    }
    if (entryNumbers.has(document.manifestEntryNumber)) {
      throw reviewImportError("KB_REVIEW_IMPORT_MANIFEST_DUPLICATE_ENTRY");
    }
    sourceIds.add(document.sourceId);
    entryNumbers.add(document.manifestEntryNumber);
  }
  return { manifestVersion: REVIEW_MANIFEST_VERSION, manifestId, documents };
};

export const reviewManifestDigest = (manifest) => {
  const validated = validateReviewManifest(manifest);
  return fingerprint({
    manifestVersion: validated.manifestVersion,
    manifestId: validated.manifestId,
    documents: validated.documents,
  });
};
