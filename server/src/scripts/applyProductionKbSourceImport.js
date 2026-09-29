import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongodb from "mongodb";

import { parseKnowledgeEntryPayload } from "../utils/knowledgeBase.js";

const { MongoClient, ObjectId } = mongodb;
const PRODUCTION_DATABASE = "gym-app";
const KNOWLEDGE_COLLECTION = "knowledgeentries";
const REQUIRED_ROLE = { role: "kb_source_maintainer", db: "admin" };
const ALLOWED_ACTIONS = new Set(["find", "update"]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

const databaseName = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

export const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value), "utf8").digest("hex");

const invalid = (code, detail = "") => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
};

const assertHash = (value, field) => {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw invalid("KB_SOURCE_IMPORT_HASH_INVALID", field);
  }
};

export const assertManifest = (manifest) => {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.updates)) {
    throw invalid("KB_SOURCE_IMPORT_MANIFEST_INVALID");
  }
  const seen = new Set();
  if (manifest.updates.length > 100) {
    throw invalid("KB_SOURCE_IMPORT_LIMIT_EXCEEDED");
  }
  for (const [index, update] of manifest.updates.entries()) {
    if (!ObjectId.isValid(update?.entryId) || seen.has(String(update.entryId))) {
      throw invalid("KB_SOURCE_IMPORT_ENTRY_ID_INVALID", String(index));
    }
    seen.add(String(update.entryId));
    assertHash(update.questionHash, `question:${index}`);
    assertHash(update.answerHash, `answer:${index}`);
    const parsed = parseKnowledgeEntryPayload(
      { sources: update.sources },
      { partial: true },
    );
    if (parsed.error || !parsed.value.sources?.length) {
      throw invalid("KB_SOURCE_IMPORT_SOURCE_INVALID", String(index));
    }
  }
  return manifest;
};

const assertProductionDatabase = (uri) => {
  if (!uri || databaseName(uri) !== PRODUCTION_DATABASE) {
    throw invalid("KB_SOURCE_IMPORT_DATABASE_REQUIRED");
  }
};

export const assertMaintenanceRole = async (database) => {
  let status;
  try {
    status = await database.command({ connectionStatus: 1, showPrivileges: true });
  } catch {
    throw invalid("KB_SOURCE_IMPORT_ROLE_UNVERIFIED");
  }

  const roles = status?.authInfo?.authenticatedUserRoles || [];
  if (
    roles.length !== 1 ||
    roles[0]?.role !== REQUIRED_ROLE.role ||
    roles[0]?.db !== REQUIRED_ROLE.db
  ) {
    throw invalid("KB_SOURCE_IMPORT_ROLE_REQUIRED");
  }

  const privileges = status?.authInfo?.authenticatedUserPrivileges || [];
  const targetPrivileges = privileges.filter(
    (privilege) =>
      privilege?.resource?.db === PRODUCTION_DATABASE &&
      privilege?.resource?.collection === KNOWLEDGE_COLLECTION,
  );
  const hasFind = targetPrivileges.some((privilege) =>
    (privilege.actions || []).includes("find"),
  );
  const hasUpdate = targetPrivileges.some((privilege) =>
    (privilege.actions || []).includes("update"),
  );
  const hasUnexpected = targetPrivileges.some((privilege) =>
    (privilege.actions || []).some((action) => !ALLOWED_ACTIONS.has(action)),
  );
  const hasOutOfScope = privileges.some(
    (privilege) =>
      privilege?.resource?.db !== PRODUCTION_DATABASE ||
      privilege?.resource?.collection !== KNOWLEDGE_COLLECTION,
  );
  if (!hasFind || !hasUpdate || hasUnexpected || hasOutOfScope) {
    throw invalid("KB_SOURCE_IMPORT_PRIVILEGE_SCOPE_INVALID");
  }
};

const sourceFilter = {
  $or: [{ sources: { $exists: false } }, { sources: { $size: 0 } }],
};

export const buildImportPlan = (documents, manifest) => {
  assertManifest(manifest);
  const byId = new Map((documents || []).map((document) => [String(document._id), document]));
  return manifest.updates.map((update) => {
    const document = byId.get(String(update.entryId));
    if (!document) throw invalid("KB_SOURCE_IMPORT_ENTRY_NOT_FOUND", String(update.entryId));
    if (sha256(document.question) !== update.questionHash) {
      throw invalid("KB_SOURCE_IMPORT_QUESTION_DRIFT", String(update.entryId));
    }
    if (sha256(document.answer) !== update.answerHash) {
      throw invalid("KB_SOURCE_IMPORT_ANSWER_DRIFT", String(update.entryId));
    }
    if (Array.isArray(document.sources) && document.sources.length > 0) {
      throw invalid("KB_SOURCE_IMPORT_EXISTING_SOURCES", String(update.entryId));
    }
    if (!Array.isArray(document.sources) && document.sources !== undefined) {
      throw invalid("KB_SOURCE_IMPORT_SOURCES_INVALID", String(update.entryId));
    }
    const parsed = parseKnowledgeEntryPayload(
      { sources: update.sources },
      { partial: true },
    );
    if (parsed.error) throw invalid("KB_SOURCE_IMPORT_SOURCE_INVALID", String(update.entryId));
    return {
      _id: document._id,
      question: document.question,
      answer: document.answer,
      sources: parsed.value.sources,
      filter: {
        _id: document._id,
        question: document.question,
        answer: document.answer,
        ...sourceFilter,
      },
    };
  });
};

export const buildSourceOnlyUpdate = (sources) => ({
  $set: {
    sources,
    evidenceLevel: "source_backed",
    reviewStatus: "needs_review",
    reviewedBy: null,
    reviewedAt: null,
    status: "draft",
  },
  $inc: { revision: 1 },
});

const manifestFile = (value) =>
  path.resolve(
    process.cwd(),
    value || "src/config/productionKbSourceImportManifest.json",
  );

const readManifest = async (value) => {
  try {
    return assertManifest(JSON.parse(await fs.readFile(manifestFile(value), "utf8")));
  } catch (error) {
    if (error?.code?.startsWith("KB_SOURCE_IMPORT_")) throw error;
    throw invalid("KB_SOURCE_IMPORT_MANIFEST_READ_FAILED");
  }
};

const loadDocuments = async (collection, manifest) =>
  collection
    .find(
      { _id: { $in: manifest.updates.map((item) => new ObjectId(item.entryId)) } },
      { projection: { _id: 1, question: 1, answer: 1, sources: 1 } },
    )
    .toArray();

export const runProductionKbSourceImport = async ({
  env = process.env,
  apply = false,
  manifestPath,
} = {}) => {
  const uri = env.PRODUCTION_KB_MAINTENANCE_URI;
  assertProductionDatabase(uri);
  const manifest = await readManifest(manifestPath);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const database = client.db(PRODUCTION_DATABASE);
    await assertMaintenanceRole(database);
    const collection = database.collection(KNOWLEDGE_COLLECTION);
    const documents = await loadDocuments(collection, manifest);
    const plan = buildImportPlan(documents, manifest);
    if (!apply) {
      return {
        success: true,
        mode: "dry-run",
        target: "production",
        planned: plan.length,
        sourceCount: plan.reduce((sum, item) => sum + item.sources.length, 0),
      };
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of plan) {
          const result = await collection.updateOne(
            item.filter,
            buildSourceOnlyUpdate(item.sources),
            { session },
          );
          if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
            throw invalid("KB_SOURCE_IMPORT_CONCURRENT_CHANGE", String(item._id));
          }
        }
      });
    } finally {
      await session.endSession();
    }
    return {
      success: true,
      mode: "apply",
      target: "production",
      updated: plan.length,
      sourceCount: plan.reduce((sum, item) => sum + item.sources.length, 0),
      reviewRequired: true,
    };
  } finally {
    await client.close();
  }
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  const result = await runProductionKbSourceImport({ apply });
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code || "KB_SOURCE_IMPORT_FAILED" })}\n`);
    process.exitCode = 1;
  });
}
