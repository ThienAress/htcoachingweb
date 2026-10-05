import mongodb from "mongodb";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { MongoClient } = mongodb;
const PRODUCTION_KB_DATABASE = "gym-app";
const MAX_KB_DOCUMENTS = 5000;
const SOURCE_PROJECTION = {
  _id: 1,
  question: 1,
  answer: 1,
  category: 1,
  sources: 1,
  evidenceLevel: 1,
  reviewStatus: 1,
  freshnessClass: 1,
  reviewDueAt: 1,
  status: 1,
  updatedAt: 1,
};

const databaseName = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

const assertProductionKnowledgeSourceReadOnly = async (sourceDb) => {
  if (!sourceDb) throw new Error("KB_SOURCE_READ_DATABASE_REQUIRED");
  let status;
  try {
    status = await sourceDb.command({ connectionStatus: 1, showPrivileges: true });
  } catch {
    throw Object.assign(new Error("KB_SOURCE_READ_ROLE_UNVERIFIED"), {
      code: "KB_SOURCE_READ_ROLE_UNVERIFIED",
    });
  }
  const roles = status?.authInfo?.authenticatedUserRoles || [];
  if (roles.length !== 1 || roles[0]?.role !== "read" || roles[0]?.db !== PRODUCTION_KB_DATABASE) {
    throw Object.assign(new Error("KB_SOURCE_READ_ONLY_ROLE_REQUIRED"), {
      code: "KB_SOURCE_READ_ONLY_ROLE_REQUIRED",
    });
  }
  const writeActions = new Set([
    "insert",
    "remove",
    "update",
    "dropCollection",
    "dropIndex",
    "createCollection",
    "createIndex",
    "collMod",
  ]);
  if ((status?.authInfo?.authenticatedUserPrivileges || []).some((privilege) =>
    (privilege.actions || []).some((action) => writeActions.has(action)))) {
    throw Object.assign(new Error("KB_SOURCE_READ_WRITE_PRIVILEGE_REJECTED"), {
      code: "KB_SOURCE_READ_WRITE_PRIVILEGE_REJECTED",
    });
  }
};

const loadProductionKnowledgeEntries = async (sourceDb) => {
  const entries = await sourceDb
    .collection("knowledgeentries")
    .find({}, { projection: SOURCE_PROJECTION })
    .sort({ _id: 1 })
    .limit(MAX_KB_DOCUMENTS + 1)
    .toArray();
  if (entries.length > MAX_KB_DOCUMENTS) {
    throw Object.assign(new Error("KB_SOURCE_DOCUMENT_LIMIT_EXCEEDED"), {
      code: "KB_SOURCE_DOCUMENT_LIMIT_EXCEEDED",
    });
  }
  return entries;
};

const cleanDate = (value) => (value ? new Date(value).toISOString() : null);

const cleanSource = (source) => ({
  type: source?.type || null,
  title: source?.title || null,
  publisher: source?.publisher || null,
  url: source?.url || null,
  publishedAt: cleanDate(source?.publishedAt),
  retrievedAt: cleanDate(source?.retrievedAt),
  evidenceTier: source?.evidenceTier || null,
});

export const buildSourceReviewPacket = (entries, { generatedAt = new Date() } = {}) => ({
  version: 1,
  generatedAt: new Date(generatedAt).toISOString(),
  documents: (entries || []).map((entry) => ({
    sourceId: String(entry._id),
    question: String(entry.question || ""),
    answer: String(entry.answer || ""),
    category: entry.category || "general",
    status: entry.status || null,
    existingSources: Array.isArray(entry.sources)
      ? entry.sources.map(cleanSource)
      : [],
    evidenceLevel: entry.evidenceLevel || "legacy_unverified",
    reviewStatus: entry.reviewStatus || "needs_review",
    freshnessClass: entry.freshnessClass || "stable",
    reviewDueAt: cleanDate(entry.reviewDueAt),
    updatedAt: cleanDate(entry.updatedAt),
  })),
});

const writePacket = async (packet, outputPath) => {
  const target = path.resolve(
    process.cwd(),
    outputPath || "../artifacts/production-kb-source-review.json",
  );
  await writeFile(target, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return target;
};

export const runKnowledgeBaseSourceReviewExport = async ({
  env = process.env,
  now = new Date(),
} = {}) => {
  if (!env.PRODUCTION_KB_READONLY_URI) {
    throw Object.assign(new Error("KB_SOURCE_READ_URI_REQUIRED"), {
      code: "KB_SOURCE_READ_URI_REQUIRED",
    });
  }
  if (databaseName(env.PRODUCTION_KB_READONLY_URI) !== PRODUCTION_KB_DATABASE) {
    throw Object.assign(new Error("KB_SOURCE_READ_DATABASE_REQUIRED"), {
      code: "KB_SOURCE_READ_DATABASE_REQUIRED",
    });
  }
  const sourceClient = new MongoClient(env.PRODUCTION_KB_READONLY_URI);
  try {
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    await assertProductionKnowledgeSourceReadOnly(sourceDb);
    const entries = await loadProductionKnowledgeEntries(sourceDb);
    const packet = buildSourceReviewPacket(entries, { generatedAt: now });
    const outputPath = await writePacket(packet, env.KB_SOURCE_REVIEW_OUTPUT);
    return {
      success: true,
      mode: "export",
      target: "production",
      outputPath,
      summary: {
        sourceDocuments: entries.length,
        publishedDocuments: entries.filter((entry) => entry.status === "published").length,
        documentsWithSources: entries.filter((entry) => entry.sources?.length).length,
        documentsWithoutSources: entries.filter((entry) => !entry.sources?.length).length,
      },
    };
  } finally {
    await sourceClient.close();
  }
};

const main = async () => {
  process.stdout.write(`${JSON.stringify(await runKnowledgeBaseSourceReviewExport(), null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code || "KB_SOURCE_REVIEW_EXPORT_FAILED" })}\n`);
    process.exitCode = 1;
  });
}
