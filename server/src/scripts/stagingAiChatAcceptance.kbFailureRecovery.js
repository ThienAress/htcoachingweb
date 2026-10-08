import mongoose from "mongoose";
import { kbFailureProofDigest, validateCompletedKbFailureProof } from "./stagingAiChatAcceptance.kbFailure.js";

const reject = (message) => Object.assign(new Error(message), {
  code: "STAGING_KB_FAILURE_RECOVERY_REJECTED",
});
const fail = (condition, message) => {
  if (!condition) throw reject(message);
};

export const validateKbFailureArchive = ({ archive, evidence, env }) => {
  fail(archive && Number.isSafeInteger(archive.artifactId) && archive.artifactId > 0,
    "Immutable recovery archive is required before deletion");
  fail(Number.isSafeInteger(archive.workflowRunId) && archive.workflowRunId > 0 &&
    Number(archive.workflowRunId) === Number(env?.GITHUB_RUN_ID), "Archive workflow is not this run");
  fail(Number.isSafeInteger(archive.runAttempt) && archive.runAttempt > 0 &&
    Number(archive.runAttempt) === Number(env?.GITHUB_RUN_ATTEMPT || 1),
  "Archive attempt is not this run");
  fail(archive.evidenceDigest === kbFailureProofDigest(evidence), "Archive digest does not match proof");
  return archive;
};

export const deleteArchivedKbFailure = async ({
  db, intent, evidence, archive, env, now = () => Date.now(),
}) => {
  fail(db?.databaseName === "htcoaching_staging", "Recovery database is not staging");
  validateKbFailureArchive({ archive, evidence, env });
  let proof;
  try { proof = validateCompletedKbFailureProof(evidence, intent); } catch { throw reject("Proof is invalid"); }
  fail(env?.GITHUB_SHA === proof.recoveryCodeSha && env?.GITHUB_ACTOR === proof.operatorActor,
    "Recovery operator does not match proof");
  fail(String(env?.STAGING_AI_SOURCE_WORKFLOW_RUN_ID) === String(proof.sourceWorkflowRunId),
    "Source workflow does not match proof");
  fail(now() > Date.parse(proof.expiresAt), "Registered receipt has not expired");
  const claims = db.collection("staging_ai_acceptance_claims");
  const tombstone = await claims.findOne({ _id: proof.runId, recordType: "run", runId: proof.runId,
    state: "revoked" });
  fail(Boolean(tombstone), "Revoked run tombstone is missing");
  const actor = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(proof.actorId), role: "admin",
    email: `ac009-admin.${proof.runId}@example.invalid` });
  fail(Boolean(actor), "Synthetic admin actor is missing");
  const receipt = await claims.findOne({ _id: proof.jti, recordType: "capability", runId: proof.runId,
    actorId: proof.actorId, releaseSha: proof.releaseSha, requestId: proof.capabilityRequestId,
    receiptVersion: 2, receiptState: "admitted", status: "claimed", action: "kb_search",
    purpose: "kb_search_root", mode: "observe_only", conversationId: null, outcome: null,
  });
  fail(Boolean(receipt), "Registered admitted receipt is missing or changed");
  fail(new Date(receipt.expiresAt).toISOString() === proof.expiresAt &&
    new Date(receipt.admittedAt).toISOString() === proof.admittedAt &&
    receipt.payloadDigest === proof.payloadDigest && receipt.runtimeInstanceId === proof.runtimeInstanceId,
  "Receipt provenance does not match proof");
  const deleted = await claims.deleteOne({ _id: proof.jti, recordType: "capability", runId: proof.runId,
    actorId: proof.actorId, receiptState: "admitted", status: "claimed", action: "kb_search",
    purpose: "kb_search_root", mode: "observe_only", outcome: null, conversationId: null,
    releaseSha: proof.releaseSha, requestId: proof.capabilityRequestId, receiptVersion: 2,
    payloadDigest: proof.payloadDigest, runtimeInstanceId: proof.runtimeInstanceId,
    admittedAt: new Date(proof.admittedAt), expiresAt: new Date(proof.expiresAt),
  });
  fail(deleted.deletedCount === 1, "Receipt CAS deletion lost the race");
  return { deleted: true, artifactId: archive.artifactId, jti: proof.jti };
};
