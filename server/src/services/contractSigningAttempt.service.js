import crypto from "node:crypto";
import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import ContractSigningAttempt from "../models/ContractSigningAttempt.js";
import { enableContractEmailPreferences } from "./notificationPreference.service.js";
import { contractError } from "./contractRevision.service.js";

const LEASE_MS = 5 * 60 * 1000;
const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority", journal: true }, readPreference: "primary" };

// Shared production seam for reservation, finalization and the recovery scheduler.
export async function reserveSigningAttempt({ contractId, clientId }) {
  const attemptId = new mongoose.Types.ObjectId();
  const candidateFileId = new mongoose.Types.ObjectId();
  const leaseToken = crypto.randomUUID();
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  const session = await mongoose.startSession();
  let contract;
  try {
    await session.withTransaction(async () => {
      contract = await Contract.findOneAndUpdate(
        { _id: contractId, clientId, status: "viewed" },
        { $set: { status: "signing", signingAttemptId: attemptId } },
        { returnDocument: "after", session },
      );
      if (!contract) return;
      await ContractSigningAttempt.create([{ _id: attemptId, contractId, clientId, candidateFileId, leaseToken, leaseUntil, nextRecoveryAt: leaseUntil }], { session });
    }, transactionOptions);
  } catch {
    // Do not upload after uncertain reservation; recovery fences the durable attempt.
    throw contractError("CONTRACT_SIGNING_OUTCOME_UNKNOWN", 503, "Chưa xác định kết quả ký. Vui lòng tải lại hợp đồng.");
  } finally {
    await session.endSession();
  }
  return contract ? { contract, attemptId, candidateFileId, leaseToken } : null;
}

export async function readCommittedSigning({ contractId, clientId, candidateFileId }) {
  return Contract.findOne({ _id: contractId, clientId, status: "signed", signedPdfFileId: candidateFileId })
    .read("primary").readConcern("majority");
}

export async function prepareSigningUpload({ reservation, fileHash }) {
  const result = await ContractSigningAttempt.updateOne(
    { _id: reservation.attemptId, phase: "active", leaseToken: reservation.leaseToken, leaseUntil: { $gt: new Date() }, candidateFileHash: { $exists: false } },
    { $set: { candidateFileHash: fileHash } }, { runValidators: true },
  );
  if (result.modifiedCount !== 1) throw contractError("CONTRACT_SIGNING_CONFLICT", 409, "Yêu cầu ký đã hết hiệu lực. Vui lòng ký lại.");
}

export async function finalizeSigningAttempt({ reservation, clientId, signatureImage, fileHash, signedAt, ipAddress, userAgent, enableEmailPreferences }) {
  const { contract, attemptId, candidateFileId, leaseToken } = reservation;
  const session = await mongoose.startSession();
  let signed;
  try {
    await session.withTransaction(async () => {
      const attempt = await ContractSigningAttempt.updateOne(
        { _id: attemptId, contractId: contract._id, clientId, candidateFileId, candidateFileHash: fileHash, phase: "active", leaseToken, leaseUntil: { $gt: new Date() } },
        { $set: { phase: "committed", finalizedAt: signedAt } }, { session },
      );
      if (attempt.modifiedCount !== 1) throw contractError("CONTRACT_SIGNING_CONFLICT", 409, "Yêu cầu ký đã hết hiệu lực. Vui lòng tải lại hợp đồng và ký lại.");
      signed = await Contract.findOneAndUpdate(
        { _id: contract._id, clientId, status: "signing", signingAttemptId: attemptId },
        { $set: { status: "signed", signatureImage, signedAt, signedPdfFileId: candidateFileId, fileHash },
          $push: { auditTrail: { action: "signed", ipAddress, userAgent, timestamp: signedAt } } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!signed) throw contractError("CONTRACT_SIGNING_CONFLICT", 409, "Hợp đồng đã thay đổi. Vui lòng tải lại.");
      if (enableEmailPreferences) await enableContractEmailPreferences({ recipientId: clientId, session });
    }, transactionOptions);
    return signed;
  } finally {
    await session.endSession();
  }
}

async function cleanupAbortedCandidate(attempt) {
  // The irreversible aborted fence prevents every later finalize. Never delete a
  // candidate referenced by ANY Contract (including anomalous/terminal states).
  if (await Contract.exists({ signedPdfFileId: attempt.candidateFileId }).read("primary").readConcern("majority")) return;
  const file = await mongoose.connection.db.collection("contracts.files").findOne({ _id: attempt.candidateFileId }, { projection: { metadata: 1 } });
  if (file && (String(file.metadata?.contractId) !== String(attempt.contractId) || String(file.metadata?.signingAttemptId) !== String(attempt._id))) {
    throw contractError("CONTRACT_SIGNING_FILE_BINDING_INVALID", 409, "Candidate PDF không khớp signing attempt; cần kiểm tra thủ công.");
  }
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
  try {
    await bucket.delete(attempt.candidateFileId);
  } catch (error) {
    if (!String(error.message).includes("File not found")) throw error;
  }
  // Keep the tombstone even when absent: a late upload can still create chunks/file.
}

export async function recoverContractSigningAttempts({ limit = 20, now = new Date() } = {}) {
  const batchLimit = Math.max(1, Math.min(Number.isSafeInteger(limit) ? limit : 20, 100));
  let processed = 0;
  for (; processed < batchLimit; processed += 1) {
    const token = crypto.randomUUID();
    const attempt = await ContractSigningAttempt.findOneAndUpdate(
      { phase: { $in: ["active", "aborted"] }, nextRecoveryAt: { $lte: now }, leaseUntil: { $lte: now } },
      { $set: { leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
      { returnDocument: "after", sort: { nextRecoveryAt: 1 } },
    );
    if (!attempt) break;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const owned = await ContractSigningAttempt.findOne({ _id: attempt._id, leaseToken: token, phase: { $in: ["active", "aborted"] } }).session(session);
        if (!owned) return;
        const referenced = await Contract.exists({ signedPdfFileId: attempt.candidateFileId }).session(session);
        if (referenced) {
          await ContractSigningAttempt.updateOne({ _id: attempt._id, leaseToken: token }, { $set: { phase: "committed" } }, { session });
          return;
        }
        // Writing the same attempt fences a concurrent finalize transaction. Only
        // this successful transaction proves the candidate cannot commit later.
        await ContractSigningAttempt.updateOne({ _id: attempt._id, leaseToken: token }, { $set: { phase: "aborted", abortedAt: owned.abortedAt || now } }, { session });
        await Contract.updateOne(
          { _id: attempt.contractId, status: "signing", signingAttemptId: attempt._id },
          { $set: { status: "viewed" }, $unset: { signingAttemptId: 1 } }, { session },
        );
      }, transactionOptions);
      const fenced = await ContractSigningAttempt.findOne({ _id: attempt._id, leaseToken: token, phase: "aborted" }).read("primary").readConcern("majority");
      if (fenced) await cleanupAbortedCandidate(fenced);
      await ContractSigningAttempt.updateOne({ _id: attempt._id, leaseToken: token }, {
        $set: { cleanupCheckedAt: now, nextRecoveryAt: new Date(now.getTime() + 60 * 60 * 1000) },
      });
    } finally {
      await session.endSession();
    }
  }
  return { processed };
}
