import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { validateStagingOperation } from "../config/stagingOperationSafety.js";
import { resolveMongoConnectionOptions } from "../config/mongoConnectionOptions.js";
import { EXPECTED_API_ORIGIN, EXPECTED_CLIENT_URL } from "./stagingAiChatAcceptance.config.js";

const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const OID = /^[a-f0-9]{24}$/i;
const COLLECTIONS = ["chatconversations", "serviceusagebuckets", "aimemories",
  "aimemorypreferences", "aitoolconfirmations", "aimoderationstates", "users"];
const REPORT_COLLECTIONS = ["staging_ai_acceptance_claims", ...COLLECTIONS];
const ENTRYPOINT = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const fail = (code, message = code) => Object.assign(new Error(message), { code });
const databaseName = (uri) => {
  try { return decodeURIComponent(new URL(String(uri || "")).pathname).replace(/^\/+/, "").split("/", 1)[0]; }
  catch { return ""; }
};
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

export const parseReliabilityRecoveryIntent = (value) => {
  const keys = ["schemaVersion", "kind", "releaseSha", "runId", "userId", "adminUserId", "seededConversationId", "createdAt"];
  if (!exactKeys(value, keys) || value.schemaVersion !== 1 ||
      value.kind !== "staging-ai-reliability-recovery-intent" || !SHA.test(value.releaseSha || "") ||
      !UUID.test(value.runId || "") || value.runId !== String(value.runId).toLowerCase() ||
      !OID.test(value.userId || "") || !OID.test(value.adminUserId || "") ||
      !OID.test(value.seededConversationId || "") || value.userId === value.adminUserId ||
      Number.isNaN(Date.parse(value.createdAt || ""))) {
    throw fail("STAGING_AI_RELIABILITY_RECOVERY_INTENT_INVALID", "Recovery intent schema is invalid");
  }
  return Object.freeze({ ...value, runId: value.runId.toLowerCase() });
};

export const validateReliabilityRecoveryConfig = (env, intent) => {
  const safety = validateStagingOperation({ env, confirmationVariable: "CONFIRM_STAGING_AI_RELIABILITY_RECOVERY" });
  const findings = [...safety.errors];
  const add = (code) => { if (!findings.includes(code)) findings.push(code); };
  if (env.APP_ENV !== "staging") add("APP_ENV_EXACT");
  if (databaseName(env.MONGO_URI) !== "htcoaching_staging") add("DATABASE_EXACT");
  if (env.CLIENT_URL !== EXPECTED_CLIENT_URL) add("CLIENT_URL_EXACT");
  if (env.PUBLIC_API_ORIGIN !== EXPECTED_API_ORIGIN) add("PUBLIC_API_ORIGIN_EXACT");
  if (env.CONFIRM_STAGING_AI_RELIABILITY_RECOVERY !== "yes") add("CONFIRMATION_EXACT");
  if (!SHA.test(env.RENDER_GIT_COMMIT || "") || env.RENDER_GIT_COMMIT !== intent.releaseSha) add("RENDER_GIT_COMMIT_INTENT_EXACT");
  if (env.RELEASE_SHA !== intent.releaseSha) add("RELEASE_SHA_INTENT_EXACT");
  return { valid: findings.length === 0, findings };
};

const emailFor = (runId, role) => `${role === "admin" ? "reliability-admin" : "reliability"}.${runId}@example.invalid`;
const emptyReport = (intent, deleted, alreadyClean) => ({
  schemaVersion: 1, kind: "staging-ai-reliability-recovery-report", releaseSha: intent.releaseSha,
  runId: intent.runId, deleted, alreadyClean, verified: true, residue: 0,
});
const availableCollections = async (db) => new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));

export const recoverStagingAiReliability = async ({ env = process.env, intent: rawIntent, db } = {}) => {
  const intent = parseReliabilityRecoveryIntent(rawIntent);
  const config = validateReliabilityRecoveryConfig(env, intent);
  if (!config.valid) throw fail("STAGING_AI_RELIABILITY_RECOVERY_REJECTED", config.findings.join(", "));
  if (!db || db.databaseName !== "htcoaching_staging") throw fail("STAGING_AI_RELIABILITY_RECOVERY_DATABASE_INVALID");
  const available = await availableCollections(db);
  const control = available.has("staging_ai_acceptance_claims") ? db.collection("staging_ai_acceptance_claims") : null;
  if (control && await control.findOne({ $or: [{ runId: intent.runId }, { _id: intent.runId }] })) {
    throw fail("STAGING_AI_RELIABILITY_RECOVERY_CONTROL_RESIDUE");
  }
  const userFilter = { _id: { $in: [new mongoose.Types.ObjectId(intent.userId), new mongoose.Types.ObjectId(intent.adminUserId)] } };
  const users = available.has("users") ? await db.collection("users").find(userFilter, { projection: { _id: 1, email: 1, role: 1 } }).toArray() : [];
  if (users.some((user) => (String(user._id) === intent.userId && (user.email !== emailFor(intent.runId, "user") || user.role !== "user")) ||
      (String(user._id) === intent.adminUserId && (user.email !== emailFor(intent.runId, "admin") || user.role !== "admin")))) {
    throw fail("STAGING_AI_RELIABILITY_RECOVERY_OWNERSHIP_INVALID");
  }
  const userIds = userFilter._id.$in;
  const activeFilter = { userId: { $in: userIds } };
  for (const name of ["chatconversations"]) {
    if (available.has(name)) {
      const total = await db.collection(name).countDocuments(activeFilter);
      const inactive = await db.collection(name).countDocuments({ ...activeFilter,
        $or: [{ activeStreamId: { $exists: false } }, { activeStreamId: null }, { activeStreamId: "" }],
      });
      if (inactive !== total) throw fail("STAGING_AI_RELIABILITY_RECOVERY_ACTIVE_STREAM");
    }
  }
  if (available.has("chatconversations")) {
    const seeded = await db.collection("chatconversations").findOne({ _id: new mongoose.Types.ObjectId(intent.seededConversationId) }, { projection: { userId: 1 } });
    if (seeded && ![intent.userId, intent.adminUserId].includes(String(seeded.userId))) throw fail("STAGING_AI_RELIABILITY_RECOVERY_OWNERSHIP_INVALID");
  }
  const before = Object.fromEntries(REPORT_COLLECTIONS.map((name) => [name, 0]));
  for (const name of COLLECTIONS) if (available.has(name)) before[name] = await db.collection(name)
    .countDocuments(name === "users" ? userFilter : activeFilter);
  const alreadyClean = Object.values(before).every((count) => count === 0);
  if (!alreadyClean) {
    for (const name of COLLECTIONS) if (available.has(name)) await db.collection(name)
      .deleteMany(name === "users" ? userFilter : activeFilter);
  }
  const residue = Object.fromEntries(REPORT_COLLECTIONS.map((name) => [name, 0]));
  for (const name of COLLECTIONS) if (available.has(name)) residue[name] = await db.collection(name)
    .countDocuments(name === "users" ? userFilter : activeFilter);
  if (residue.users !== 0 || residue.chatconversations !== 0 || Object.values(residue).some((count) => count !== 0)) {
    throw fail("STAGING_AI_RELIABILITY_RECOVERY_RESIDUE");
  }
  const deleted = Object.fromEntries(COLLECTIONS.map((name) => [name, before[name] || 0]));
  return emptyReport(intent, deleted, alreadyClean);
};

export const runReliabilityRecoveryCli = async ({ env = process.env } = {}) => {
  const intentPath = env.STAGING_AI_RELIABILITY_RECOVERY_INTENT;
  const reportPath = env.STAGING_AI_RELIABILITY_RECOVERY_REPORT_OUTPUT;
  if (!intentPath || !reportPath) throw fail("STAGING_AI_RELIABILITY_RECOVERY_PATH_REQUIRED");
  const intent = parseReliabilityRecoveryIntent(JSON.parse(await fs.readFile(path.resolve(intentPath), "utf8")));
  const config = validateReliabilityRecoveryConfig(env, intent);
  if (!config.valid) throw fail("STAGING_AI_RELIABILITY_RECOVERY_REJECTED", config.findings.join(", "));
  await mongoose.connect(
    env.MONGO_URI,
    resolveMongoConnectionOptions({ durable: true, autoIndex: false }),
  );
  try {
    const report = await recoverStagingAiReliability({ env, intent, db: mongoose.connection.db });
    await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
    await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report;
  } finally { await mongoose.disconnect(); }
};

if (ENTRYPOINT) runReliabilityRecoveryCli().catch((error) => {
  process.stderr.write(`Staging AI reliability recovery failed (${error.code || "STAGING_AI_RELIABILITY_RECOVERY_FAILED"}).\n`);
  process.exitCode = 1;
});
