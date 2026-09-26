import mongoose from "mongoose";

// Durable, bounded metadata only. No pending signature/terms/PII and no TTL:
// aborted tombstones must outlive uploaders that can resume after a crash.
const schema = new mongoose.Schema({
  contractId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  candidateFileId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  candidateFileHash: { type: String, match: /^[a-f0-9]{64}$/ },
  phase: { type: String, enum: ["active", "committed", "aborted"], default: "active", required: true },
  leaseUntil: { type: Date, required: true },
  leaseToken: { type: String, maxlength: 36, required: true },
  nextRecoveryAt: { type: Date, required: true },
  finalizedAt: Date,
  abortedAt: Date,
  cleanupCheckedAt: Date,
}, { timestamps: true });
schema.index({ candidateFileId: 1 }, { name: "uniq_contract_signing_candidate", unique: true });
schema.index({ phase: 1, nextRecoveryAt: 1, leaseUntil: 1 }, { name: "contract_signing_recovery_claim" });
schema.index({ contractId: 1 }, { name: "contract_signing_history" });
export default mongoose.model("ContractSigningAttempt", schema);
