import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as waitFor } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { EXPECTED_API_ORIGIN, EXPECTED_CLIENT_URL } from "./stagingAiChatAcceptance.config.js";
import { createExactCleanup } from "./stagingAiChatAcceptance.cleanup.js";
import { knowledgeFixtureQueries } from "./stagingAiChatAcceptance.http.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";
import {
  assertFixtureCreatePending,
  assertFixtureCreateTerminal,
  deletePendingFixtureJournal,
  deleteTerminalFixtureJournal,
  repairPendingFixtureCreateJournal,
} from "./stagingAiChatAcceptance.fixture.js";
import { validateFixtureRejectionEvidence } from "./stagingAiChatAcceptance.rejectionEvidence.js";

const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTENT_KEYS = ["schemaVersion", "kind", "releaseSha", "runId", "marker", "createdAt"];
const REPORT_KEYS = ["schemaVersion", "kind", "releaseSha", "runId", "recoveredReceiptCount", "alreadyClean", "residue", "verified"];
const REPORT_V2_KEYS = [...REPORT_KEYS, "fixtureRejectionProof"];
const FIXTURE_REJECTION_PROOF_KEYS = ["proofMethod", "evidenceDigest"];
const RECEIPT_PURPOSES = new Map([
  ["live_kb_provider", ["ai_chat", "observe_only"]],
  ["paced_conversation", ["ai_chat", "paced_response"]],
  ["stop", ["ai_chat", "paced_response"]],
  ["provider_failure_retry", ["ai_chat", "provider_failure_before_llm"]],
  ["recovery_retry", ["ai_chat", "observe_only"]],
  ["provider_failure_edit", ["ai_chat", "provider_failure_before_llm"]],
  ["recovery_edit", ["ai_chat", "observe_only"]],
  ["kb_search_root", ["kb_search", "observe_only"]],
  ["kb_search_variant", ["kb_search", "observe_only"]],
]);
const TERMINAL_OUTCOMES = new Set(["completed", "failed", "aborted", "duplicate", "rejected"]);
const DEFAULT_RECOVERY_QUIESCENCE_MS = 125_000;
const DEFAULT_POST_CLEANUP_QUIESCENCE_MS = 1_000;
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const fail = (code, message) => Object.assign(new Error(message), { code });
const databaseName = (uri) => {
  try { return decodeURIComponent(new URL(String(uri || "")).pathname).replace(/^\/+/, "").split("/", 1)[0]; } catch { return ""; }
};

export const parseRecoveryIntent = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== INTENT_KEYS.length || Object.keys(value).some((key) => !INTENT_KEYS.includes(key)) ||
      value.schemaVersion !== 1 || value.kind !== "staging-ai-chat-recovery-intent" ||
      !SHA.test(value.releaseSha || "") || !UUID.test(value.runId || "") ||
      value.marker !== `htcoaching-acceptance:${String(value.runId).toLowerCase()}` ||
      !Number.isFinite(Date.parse(value.createdAt || ""))) {
    throw fail("STAGING_AI_RECOVERY_INTENT_INVALID", "Recovery intent is not an immutable AC-009 schema v1 document");
  }
  return Object.freeze({ ...value, runId: value.runId.toLowerCase() });
};

export const validateRecoveryConfig = (env = process.env, intent) => {
  const findings = [];
  if (env.APP_ENV !== "staging") findings.push("APP_ENV_EXACT");
  if (databaseName(env.MONGO_URI) !== "htcoaching_staging") findings.push("DATABASE_EXACT");
  if (env.CLIENT_URL !== EXPECTED_CLIENT_URL) findings.push("CLIENT_URL_EXACT");
  if (env.PUBLIC_API_ORIGIN !== EXPECTED_API_ORIGIN) findings.push("PUBLIC_API_ORIGIN_EXACT");
  if (!SHA.test(String(env.RELEASE_SHA || "")) || env.RELEASE_SHA !== intent.releaseSha) findings.push("RELEASE_SHA_INTENT_EXACT");
  if (!SHA.test(String(env.RENDER_GIT_COMMIT || "")) || env.RENDER_GIT_COMMIT !== intent.releaseSha) findings.push("RENDER_GIT_COMMIT_INTENT_EXACT");
  if (env.CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY !== "yes") findings.push("CONFIRMATION_REQUIRED");
  return { valid: findings.length === 0, findings };
};

const assertRecoveryConfig = (env, intent) => {
  const result = validateRecoveryConfig(env, intent);
  if (!result.valid) throw fail("STAGING_AI_RECOVERY_REJECTED", `Recovery rejected: ${result.findings.join(", ")}`);
};
const exactEmail = (runId, role) => role === "admin"
  ? `ac009-admin.${runId}@example.invalid` : `ac009.${runId}@example.invalid`;
const validateReceipt = (receipt, intent) => {
  const contract = RECEIPT_PURPOSES.get(receipt?.purpose);
  if (!UUID.test(String(receipt?._id || "")) || receipt?.recordType !== "capability" ||
      receipt?.receiptVersion !== 2 || receipt?.runId !== intent.runId ||
      receipt?.releaseSha !== intent.releaseSha || !mongoose.isObjectIdOrHexString(receipt?.actorId) ||
      !Number.isFinite(new Date(receipt?.expiresAt).getTime()) || !contract ||
      receipt.action !== contract[0] || receipt.mode !== contract[1] ||
      !["issued", "admitted", "settled"].includes(receipt.receiptState) ||
      (receipt.receiptState === "settled" && !TERMINAL_OUTCOMES.has(receipt.outcome)) ||
      (receipt.receiptState !== "settled" && receipt.outcome != null)) {
    throw fail("STAGING_AI_RECOVERY_RECEIPT_INVALID", "Recovery refuses a receipt outside the exact AC-009 cohort contract");
  }
  return receipt;
};
const canonicalJson = (value) => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalJson(value[key]) ]));
  return value;
};
const fixtureRejectionProof = (evidence) => evidence ? {
  proofMethod: "operator_attested_render_application_log",
  evidenceDigest: createHash("sha256").update(JSON.stringify(canonicalJson(evidence))).digest("hex"),
} : null;
const validFixtureRejectionProof = (value) => value === null || (
  value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === FIXTURE_REJECTION_PROOF_KEYS.length &&
  Object.keys(value).every((key) => FIXTURE_REJECTION_PROOF_KEYS.includes(key)) &&
  value.proofMethod === "operator_attested_render_application_log" &&
  /^[a-f0-9]{64}$/.test(value.evidenceDigest || "")
);
const validateRecoveryReport = (value, expected) => {
  const isV1 = value?.schemaVersion === 1;
  const reportKeys = isV1 ? REPORT_KEYS : REPORT_V2_KEYS;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== reportKeys.length ||
      Object.keys(value).some((key) => !reportKeys.includes(key)) ||
      ![1, 2].includes(value.schemaVersion) || value.kind !== "staging-ai-chat-recovery-report" ||
      value.releaseSha !== expected.releaseSha || value.runId !== expected.runId ||
      !Number.isSafeInteger(value.recoveredReceiptCount) || value.recoveredReceiptCount < 0 ||
      typeof value.alreadyClean !== "boolean" || value.residue !== 0 || value.verified !== true ||
      (!isV1 && !validFixtureRejectionProof(value.fixtureRejectionProof))) {
    throw fail("STAGING_AI_RECOVERY_REPORT_INVALID", "Existing recovery report is not valid for this exact run");
  }
  return value;
};
const safeReport = ({ intent, report, recoveredReceipts, alreadyClean, fixtureRejectionEvidence, priorVerifiedReport }) => ({
  schemaVersion: 2,
  kind: "staging-ai-chat-recovery-report",
  releaseSha: intent.releaseSha,
  runId: intent.runId,
  recoveredReceiptCount: recoveredReceipts,
  alreadyClean,
  residue: report.residue,
  verified: report.residue === 0,
  fixtureRejectionProof: priorVerifiedReport?.schemaVersion === 2
    ? priorVerifiedReport.fixtureRejectionProof
    : fixtureRejectionProof(fixtureRejectionEvidence),
});

export const recoverStagingAiChatAcceptance = async ({
  env = process.env,
  intent: rawIntent,
  db,
  capability,
  priorVerifiedReport,
  fixtureRejectionEvidence,
  cleanupOptions = {},
  recoveryQuiescenceMs = DEFAULT_RECOVERY_QUIESCENCE_MS,
  postCleanupQuiescenceMs = DEFAULT_POST_CLEANUP_QUIESCENCE_MS,
  wait = waitFor,
} = {}) => {
  const intent = parseRecoveryIntent(rawIntent);
  assertRecoveryConfig(env, intent);
  if (priorVerifiedReport) validateRecoveryReport(priorVerifiedReport, intent);
  if (!db || db.databaseName !== "htcoaching_staging") throw fail("STAGING_AI_RECOVERY_REJECTED", "Recovery database is not exactly htcoaching_staging");
  if (!capability?.revokeStagingAiAcceptanceRun || !capability.STAGING_AI_ACCEPTANCE_COLLECTION) {
    throw new TypeError("Recovery requires the staging acceptance capability service");
  }
  if (!Number.isSafeInteger(recoveryQuiescenceMs) || recoveryQuiescenceMs < 1 ||
      !Number.isSafeInteger(postCleanupQuiescenceMs) || postCleanupQuiescenceMs < 1 ||
      typeof wait !== "function") {
    throw new TypeError("Recovery requires positive bounded quiescence windows");
  }
  const control = db.collection(capability.STAGING_AI_ACCEPTANCE_COLLECTION);
  const revocation = await capability.revokeStagingAiAcceptanceRun(intent.runId);
  if (revocation !== true && revocation?.acknowledged !== true) {
    throw fail("STAGING_AI_RECOVERY_REVOCATION_FAILED", "Recovery could not acknowledge the run tombstone");
  }
  await wait(recoveryQuiescenceMs);

  const fixtureProof = { collection: control, runId: intent.runId, releaseSha: intent.releaseSha, marker: intent.marker };
  const existingJournal = await control.findOne({ _id: `${intent.runId}:fixture-create` });
  let fixtureJournal = null;
  let rejectedPendingJournal = null;
  let attestedFixtureRejectionEvidence = null;
  if (existingJournal) {
    try {
      fixtureJournal = await assertFixtureCreateTerminal(fixtureProof);
    } catch (error) {
      if (!fixtureRejectionEvidence) {
        try {
          fixtureJournal = await repairPendingFixtureCreateJournal({
            ...fixtureProof,
            knowledgeCollection: db.collection("knowledgeentries"),
          });
        } catch {
          throw error;
        }
      } else {
        rejectedPendingJournal = await assertFixtureCreatePending(fixtureProof);
        // Operator attestation is only a compatibility escape hatch for v1,
        // which never persisted request identity. V2 rejection remains unknown.
        if (rejectedPendingJournal.journalVersion !== 1) throw error;
        const evidence = validateFixtureRejectionEvidence(fixtureRejectionEvidence, intent);
        if (evidence.recoveryCodeSha !== env.GITHUB_SHA || evidence.operatorActor !== env.GITHUB_ACTOR ||
            String(evidence.sourceWorkflowRunId) !== env.STAGING_AI_SOURCE_WORKFLOW_RUN_ID) {
          throw fail("STAGING_AI_RECOVERY_FIXTURE_REJECTION_INVALID", "Fixture rejection evidence is not bound to this manual workflow run");
        }
        const startedAt = new Date(rejectedPendingJournal.startedAt).getTime();
        const observedAt = new Date(evidence.observedAt).getTime();
        if (observedAt < startedAt || observedAt > startedAt + 60_000) {
          throw fail("STAGING_AI_RECOVERY_FIXTURE_REJECTION_INVALID", "Provider rejection is outside the exact pending journal window");
        }
        attestedFixtureRejectionEvidence = evidence;
      }
    }
  } else if (!priorVerifiedReport) {
    await assertFixtureCreateTerminal(fixtureProof);
  }
  const actorJournal = fixtureJournal || rejectedPendingJournal;
  const fixtureActor = actorJournal && await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(actorJournal.actorId) }, {
    projection: { email: 1, role: 1 },
  });
  if (fixtureActor && (fixtureActor.role !== "admin" || fixtureActor.email !== exactEmail(intent.runId, "admin"))) {
    throw fail("STAGING_AI_RECOVERY_OWNERSHIP_INVALID", "Fixture journal actor is not the exact synthetic admin");
  }

  const { question } = knowledgeFixtureQueries(intent.marker);
  const normalizedQuestion = normalizeKnowledgeQuestion(question);
  const rejectedFixture = rejectedPendingJournal ||
    (fixtureJournal?.journalVersion === 2 && fixtureJournal.outcome === "rejected" ? fixtureJournal : null);
  if (rejectedFixture && await db.collection("knowledgeentries").countDocuments({ normalizedQuestion }) !== 0) {
    throw fail("STAGING_AI_RECOVERY_FIXTURE_REJECTION_CONFLICT", "Rejected fixture proof conflicts with a persisted Knowledge Entry");
  }
  const exact = createExactCleanup({
    db,
    runId: intent.runId,
    controlCollection: capability.STAGING_AI_ACCEPTANCE_COLLECTION,
    ...cleanupOptions,
    retainRunTombstone: true,
    requireFixtureCreateProof: Boolean(fixtureJournal),
    releaseSha: intent.releaseSha,
  });
  if (!rejectedFixture) exact.registerKnowledgeQuestion(normalizedQuestion);
  if (fixtureJournal && !rejectedFixture) exact.registerKnowledgeEntry(fixtureJournal.knowledgeEntryId);
  const observed = { receipts: new Set(), users: new Set(), knowledge: new Set() };
  const inventory = async () => {
    const receipts = await control.find({ runId: intent.runId, recordType: "capability" }, {
      projection: {
        _id: 1, recordType: 1, receiptVersion: 1, runId: 1, actorId: 1,
        expiresAt: 1, receiptState: 1, releaseSha: 1, action: 1, purpose: 1,
        mode: 1, outcome: 1,
      },
    }).toArray();
    receipts.forEach((receipt) => validateReceipt(receipt, intent));
    const users = await db.collection("users").find({
      email: { $in: [exactEmail(intent.runId, "user"), exactEmail(intent.runId, "admin")] },
    }, { projection: { _id: 1, email: 1, role: 1 } }).toArray();
    if (users.length > 2 || new Set(users.map((user) => user.role)).size !== users.length ||
        users.some((user) => !["admin", "user"].includes(user.role) ||
          user.email !== exactEmail(intent.runId, user.role))) {
      throw fail("STAGING_AI_RECOVERY_OWNERSHIP_INVALID", "Recovery refuses a non-deterministic synthetic actor");
    }
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    for (const receipt of receipts) {
      const actor = usersById.get(String(receipt.actorId));
      const expectedRole = receipt.action === "kb_search" ? "admin" : "user";
      if (!actor || actor.role !== expectedRole || actor.email !== exactEmail(intent.runId, expectedRole)) {
        throw fail("STAGING_AI_RECOVERY_OWNERSHIP_INVALID", "Recovery receipt actor does not match its exact action role");
      }
      exact.registerCapabilityJti(receipt._id, new Date(receipt.expiresAt).getTime());
      observed.receipts.add(String(receipt._id));
    }
    for (const user of users) {
      exact.registerUser(user._id);
      observed.users.add(String(user._id));
    }
    const knowledge = await db.collection("knowledgeentries").find(
      { normalizedQuestion },
      { projection: { _id: 1 } },
    ).toArray();
    if (rejectedFixture && knowledge.length !== 0) {
      throw fail("STAGING_AI_RECOVERY_FIXTURE_REJECTION_CONFLICT", "A Knowledge Entry appeared after the attested rejection");
    }
    for (const entry of knowledge) {
      exact.registerKnowledgeEntry(entry._id);
      observed.knowledge.add(String(entry._id));
    }
    return { receipts, users, knowledge };
  };

  const initial = await inventory();
  const alreadyClean = initial.receipts.length === 0 && initial.users.length === 0 &&
    initial.knowledge.length === 0;
  await exact.cleanup();
  const first = await exact.verify({ allowFixtureJournal: Boolean(actorJournal) });
  if (first.residue !== 0) throw fail("STAGING_AI_RECOVERY_RESIDUE", "Recovery verification found synthetic residue");
  await wait(postCleanupQuiescenceMs);
  await inventory();
  await exact.cleanup();
  const second = await exact.verify({ allowFixtureJournal: Boolean(actorJournal) });
  if (first.residue !== 0 || second.residue !== 0) throw fail("STAGING_AI_RECOVERY_RESIDUE", "Recovery verification found synthetic residue");
  const finalInventory = await inventory();
  if (finalInventory.receipts.length || finalInventory.users.length || finalInventory.knowledge.length) {
    throw fail("STAGING_AI_RECOVERY_NOT_QUIESCENT", "Recovery retained its tombstone because synthetic writes arrived after cleanup");
  }
  if (fixtureJournal) await deleteTerminalFixtureJournal(fixtureProof);
  if (rejectedPendingJournal) await deletePendingFixtureJournal(fixtureProof);
  await exact.deleteRunTombstone();
  const final = await exact.verify();
  if (final.residue !== 0) throw fail("STAGING_AI_RECOVERY_RESIDUE", "Recovery verification found synthetic residue");
  return safeReport({
    intent,
    report: final,
    recoveredReceipts: observed.receipts.size,
    alreadyClean,
    fixtureRejectionEvidence: attestedFixtureRejectionEvidence,
    priorVerifiedReport,
  });
};

const readIntent = async (filename) => parseRecoveryIntent(JSON.parse(await fs.readFile(path.resolve(filename), "utf8")));
export const writeRecoveryReport = async (filename, report) => {
  if (!filename) return report;
  validateRecoveryReport(report, report);
  const target = path.resolve(filename);
  try {
    await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    return report;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await fs.readFile(target, "utf8"));
    } catch {
      throw fail("STAGING_AI_RECOVERY_REPORT_INVALID", "Existing recovery report cannot be validated");
    }
    return validateRecoveryReport(existing, report);
  }
};

const readPriorRecoveryReport = async (filename, intent, allowMissing) => {
  if (!filename) return undefined;
  try {
    return validateRecoveryReport(JSON.parse(await fs.readFile(path.resolve(filename), "utf8")), intent);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return undefined;
    throw fail("STAGING_AI_RECOVERY_REPORT_INVALID", "Prior recovery report cannot be validated");
  }
};
const prepareRecoveryReportOutput = async (filename) => {
  if (filename) await fs.mkdir(path.dirname(path.resolve(filename)), { recursive: true });
};

export const runRecoveryCli = async ({ env = process.env } = {}) => {
  const filename = env.STAGING_AI_ACCEPTANCE_RECOVERY_INTENT;
  if (!filename) throw fail("STAGING_AI_RECOVERY_INTENT_REQUIRED", "Recovery intent path is required");
  const intent = await readIntent(filename);
  assertRecoveryConfig(env, intent);
  const priorReportPath = env.STAGING_AI_ACCEPTANCE_PRIOR_RECOVERY_REPORT ||
    env.STAGING_AI_ACCEPTANCE_RECOVERY_REPORT_OUTPUT;
  const priorVerifiedReport = await readPriorRecoveryReport(
    priorReportPath,
    intent,
    !env.STAGING_AI_ACCEPTANCE_PRIOR_RECOVERY_REPORT,
  );
  await prepareRecoveryReportOutput(env.STAGING_AI_ACCEPTANCE_RECOVERY_REPORT_OUTPUT);
  await mongoose.connect(env.MONGO_URI, { autoIndex: false });
  try {
    const capability = await import("../services/ai/stagingAiAcceptance.service.js");
    let fixtureRejectionEvidence;
    if (env.STAGING_AI_FIXTURE_REJECTION_EVIDENCE) {
      try {
        fixtureRejectionEvidence = JSON.parse(await fs.readFile(
          path.resolve(env.STAGING_AI_FIXTURE_REJECTION_EVIDENCE), "utf8",
        ));
      } catch {
        throw fail("STAGING_AI_RECOVERY_FIXTURE_REJECTION_INVALID", "Fixture rejection evidence cannot be read");
      }
    }
    const report = await recoverStagingAiChatAcceptance({
      env,
      intent,
      db: mongoose.connection.db,
      capability,
      priorVerifiedReport,
      fixtureRejectionEvidence,
    });
    const persistedReport = await writeRecoveryReport(env.STAGING_AI_ACCEPTANCE_RECOVERY_REPORT_OUTPUT, report);
    process.stdout.write(`${JSON.stringify(persistedReport)}\n`);
    return persistedReport;
  } finally {
    await mongoose.disconnect();
  }
};

if (isEntrypoint) {
  runRecoveryCli().catch((error) => {
    process.stderr.write(`Staging AI recovery failed (${error.code || "STAGING_AI_RECOVERY_FAILED"}).\n`);
    process.exitCode = 1;
  });
}
