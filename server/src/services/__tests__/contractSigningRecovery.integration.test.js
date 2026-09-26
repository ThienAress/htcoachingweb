import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, clearCollections } from "../../__tests__/setup.js";
import Contract from "../../models/Contract.js";
import { signContract, cancelContract, expireOldContracts } from "../contract.service.js";
import ContractSigningAttempt from "../../models/ContractSigningAttempt.js";
import { reserveSigningAttempt, prepareSigningUpload, finalizeSigningAttempt, recoverContractSigningAttempts } from "../contractSigningAttempt.service.js";

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(async () => { vi.restoreAllMocks(); await clearCollections(); });
const signatureImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XgW+WQAAAABJRU5ErkJggg==";

async function fixture() {
  return Contract.create({ orderId: new mongoose.Types.ObjectId(), clientId: new mongoose.Types.ObjectId(),
    trainerId: new mongoose.Types.ObjectId(), clientInfo: { name: "Client" },
    trainerSignature: signatureImage, packageDetails: { sessions: 1 }, status: "viewed" });
}

describe("contract signing recovery", () => {
  it("keeps uncertain uncommitted state and candidate until fenced recovery", async () => {
    const contract = await fixture();
    const startSession = mongoose.startSession.bind(mongoose);
    let starts = 0;
    vi.spyOn(mongoose, "startSession").mockImplementation(async (...args) => {
      const session = await startSession(...args);
      starts += 1;
      if (starts === 2) session.withTransaction = async () => { throw new Error("synthetic connection loss before finalize"); };
      return session;
    });
    await expect(signContract({ contractId: contract._id, clientId: contract.clientId, signatureImage, acceptedTerms: true }))
      .rejects.toMatchObject({ code: "CONTRACT_SIGNING_OUTCOME_UNKNOWN", statusCode: 503 });
    const attempt = await ContractSigningAttempt.findOne({ contractId: contract._id });
    expect(String(attempt.clientId)).toBe(String(contract.clientId));
    expect({ status: (await Contract.findById(contract._id)).status,
      files: await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: attempt.candidateFileId }), phase: attempt.phase })
      .toEqual({ status: "signing", files: 1, phase: "active" });
    vi.restoreAllMocks();
    await recoverContractSigningAttempts({ now: new Date(Date.now() + 10 * 60 * 1000) });
    expect((await Contract.findById(contract._id)).status).toBe("viewed");
  });

  it("retains and returns a committed signed PDF after an unknown commit response", async () => {
    const contract = await fixture();
    const startSession = mongoose.startSession.bind(mongoose);
    vi.spyOn(mongoose, "startSession").mockImplementation(async (...args) => {
      const session = await startSession(...args);
      const transaction = session.withTransaction.bind(session);
      session.withTransaction = async (...input) => {
        const result = await transaction(...input);
        const stored = await Contract.findById(contract._id).lean();
        if (stored.status === "signed") throw Object.assign(new Error("synthetic lost commit response"), { errorLabels: ["UnknownTransactionCommitResult"] });
        return result;
      };
      return session;
    });
    const result = await signContract({ contractId: contract._id, clientId: contract.clientId, signatureImage, acceptedTerms: true }).catch(error => error);
    const stored = await Contract.findById(contract._id);
    const file = await mongoose.connection.db.collection("contracts.files").findOne({ _id: stored.signedPdfFileId });
    expect({ status: result.status, retained: Boolean(file) }).toEqual({ status: "signed", retained: true });
  });
  it("fences a crashed attempt once across two recovery workers and never auto-signs", async () => {
    const contract = await fixture();
    const reservation = await reserveSigningAttempt({ contractId: contract._id, clientId: contract.clientId });
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const results = await Promise.all([
      recoverContractSigningAttempts({ now: future }), recoverContractSigningAttempts({ now: future }),
    ]);
    const stored = await Contract.findById(contract._id).select("+signingAttemptId").lean();
    const attempt = await ContractSigningAttempt.findById(reservation.attemptId).lean();
    expect({ processed: results.reduce((sum, row) => sum + row.processed, 0), status: stored.status, phase: attempt.phase, signature: stored.signatureImage })
      .toEqual({ processed: 1, status: "viewed", phase: "aborted", signature: undefined });
  });

  it("rejects a late uploader's finalize and cleans its file on a later tombstone sweep", async () => {
    const contract = await fixture();
    const reservation = await reserveSigningAttempt({ contractId: contract._id, clientId: contract.clientId });
    const future = new Date(Date.now() + 10 * 60 * 1000);
    await recoverContractSigningAttempts({ now: future });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
    await new Promise((resolve, reject) => {
      const upload = bucket.openUploadStreamWithId(reservation.candidateFileId, "late.pdf", { metadata: { contractId: contract._id, signingAttemptId: reservation.attemptId } });
      upload.on("finish", resolve).on("error", reject).end(Buffer.from("%PDF-late"));
    });
    await expect(finalizeSigningAttempt({ reservation, clientId: contract.clientId, signatureImage, fileHash: "a".repeat(64), signedAt: new Date() }))
      .rejects.toMatchObject({ code: "CONTRACT_SIGNING_CONFLICT" });
    await recoverContractSigningAttempts({ now: new Date(future.getTime() + 2 * 60 * 60 * 1000) });
    expect(await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: reservation.candidateFileId })).toBe(0);
    expect(await ContractSigningAttempt.findById(reservation.attemptId)).not.toBeNull();
  });

  it("never cleans a candidate referenced by any contract", async () => {
    const contract = await fixture();
    const reservation = await reserveSigningAttempt({ contractId: contract._id, clientId: contract.clientId });
    await Contract.updateOne({ _id: contract._id }, { $set: { signedPdfFileId: reservation.candidateFileId, status: "signed" } });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
    await new Promise((resolve, reject) => {
      const upload = bucket.openUploadStreamWithId(reservation.candidateFileId, "referenced.pdf");
      upload.on("finish", resolve).on("error", reject).end(Buffer.from("%PDF-retained"));
    });
    await recoverContractSigningAttempts({ now: new Date(Date.now() + 10 * 60 * 1000) });
    expect(await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: reservation.candidateFileId })).toBe(1);
  });

  it("leaves legacy signing without an attempt untouched", async () => {
    const contract = await fixture();
    await Contract.updateOne({ _id: contract._id }, { $set: { status: "signing" } });
    await recoverContractSigningAttempts({ now: new Date(Date.now() + 10 * 60 * 1000) });
    expect((await Contract.findById(contract._id)).status).toBe("signing");
  });
  it("does not delete or reset after committed finalize when read-back is unavailable", async () => {
    const contract = await fixture();
    const startSession = mongoose.startSession.bind(mongoose);
    let starts = 0;
    vi.spyOn(mongoose, "startSession").mockImplementation(async (...args) => {
      const session = await startSession(...args);
      starts += 1;
      if (starts === 2) {
        const transaction = session.withTransaction.bind(session);
        session.withTransaction = async (...input) => {
          await transaction(...input);
          vi.spyOn(Contract.collection, "findOne").mockRejectedValue(new Error("synthetic read-back outage"));
          throw new Error("synthetic lost response");
        };
      }
      return session;
    });
    await expect(signContract({ contractId: contract._id, clientId: contract.clientId, signatureImage, acceptedTerms: true }))
      .rejects.toMatchObject({ code: "CONTRACT_SIGNING_OUTCOME_UNKNOWN", statusCode: 503 });
    vi.restoreAllMocks();
    const stored = await Contract.findById(contract._id);
    expect({ status: stored.status, files: await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: stored.signedPdfFileId }) })
      .toEqual({ status: "signed", files: 1 });
  });
  it("recovers a committed reservation after its response was lost without uploading or auto-signing", async () => {
    const contract = await fixture();
    const startSession = mongoose.startSession.bind(mongoose);
    vi.spyOn(mongoose, "startSession").mockImplementationOnce(async (...args) => {
      const session = await startSession(...args);
      const transaction = session.withTransaction.bind(session);
      session.withTransaction = async (...input) => { await transaction(...input); throw new Error("synthetic reserve response loss"); };
      return session;
    });
    await expect(signContract({ contractId: contract._id, clientId: contract.clientId, signatureImage, acceptedTerms: true }))
      .rejects.toMatchObject({ code: "CONTRACT_SIGNING_OUTCOME_UNKNOWN" });
    vi.restoreAllMocks();
    const attempt = await ContractSigningAttempt.findOne({ contractId: contract._id });
    await recoverContractSigningAttempts({ now: new Date(Date.now() + 10 * 60 * 1000) });
    expect({ status: (await Contract.findById(contract._id)).status, files: await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: attempt.candidateFileId }) })
      .toEqual({ status: "viewed", files: 0 });
  });

  it("serializes cancel against finalize and leaves exactly one terminal outcome", async () => {
    const contract = await fixture();
    const reservation = await reserveSigningAttempt({ contractId: contract._id, clientId: contract.clientId });
    const fileHash = "a".repeat(64);
    await prepareSigningUpload({ reservation, fileHash });
    const results = await Promise.allSettled([
      cancelContract(contract._id, "", ""),
      finalizeSigningAttempt({ reservation, clientId: contract.clientId, signatureImage, fileHash, signedAt: new Date() }),
    ]);
    const stored = await Contract.findById(contract._id);
    expect({ successes: results.filter(row => row.status === "fulfilled").length, terminal: ["cancelled", "signed"].includes(stored.status), signedAudits: stored.auditTrail.filter(row => row.action === "signed").length })
      .toEqual({ successes: 1, terminal: true, signedAudits: stored.status === "signed" ? 1 : 0 });
  });

  it("does not expire active or legacy signing while recovery owns the decision", async () => {
    const contract = await fixture();
    await Contract.collection.updateOne({ _id: contract._id }, { $set: { status: "signing", createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } });
    await expireOldContracts();
    expect((await Contract.findById(contract._id)).status).toBe("signing");
  });

  it("refuses cleanup when an unreferenced candidate file has a different binding", async () => {
    const contract = await fixture();
    const reservation = await reserveSigningAttempt({ contractId: contract._id, clientId: contract.clientId });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
    await new Promise((resolve, reject) => {
      const upload = bucket.openUploadStreamWithId(reservation.candidateFileId, "mismatch.pdf", { metadata: { contractId: new mongoose.Types.ObjectId(), signingAttemptId: reservation.attemptId } });
      upload.on("finish", resolve).on("error", reject).end(Buffer.from("%PDF-retain"));
    });
    await expect(recoverContractSigningAttempts({ now: new Date(Date.now() + 10 * 60 * 1000) }))
      .rejects.toMatchObject({ code: "CONTRACT_SIGNING_FILE_BINDING_INVALID" });
    expect(await mongoose.connection.db.collection("contracts.files").countDocuments({ _id: reservation.candidateFileId })).toBe(1);
  });
});
