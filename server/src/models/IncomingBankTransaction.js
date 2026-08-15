import mongoose from "mongoose";

export const INCOMING_BANK_TRANSACTION_STATUSES = [
  "received",
  "settled",
  "needs_review",
  "ignored",
  "reversed",
];

export const INCOMING_BANK_REVIEW_REASONS = [
  "ACCOUNT_MISMATCH",
  "OUTGOING_TRANSACTION",
  "PRE_CUTOVER_TRANSACTION",
  "PRE_CUTOVER_DEPOSIT",
  "CODE_NOT_FOUND",
  "DEPOSIT_NOT_FOUND",
  "DEPOSIT_NOT_SETTLEABLE",
  "AMOUNT_MISMATCH",
  "CODE_MISMATCH_OR_AMBIGUOUS",
  "OUTSIDE_AUTO_SETTLEMENT_WINDOW",
  "POSSIBLE_CROSS_CHANNEL_DUPLICATE",
  "POSSIBLE_LEGACY_MANUAL_CREDIT",
  "ADMIN_IGNORED",
];

const sourceAliasSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["webhook", "reconciliation"],
      required: true,
    },
    providerTransactionId: {
      type: String,
      required: true,
      maxlength: 100,
    },
  },
  { _id: false },
);

const incomingBankTransactionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["sepay"], required: true },
    source: {
      type: String,
      enum: ["webhook", "reconciliation"],
      required: true,
    },
    providerTransactionId: {
      type: String,
      required: true,
      maxlength: 100,
    },
    sourceAliases: { type: [sourceAliasSchema], default: [] },
    canonicalReferenceHash: {
      type: String,
      default: null,
      minlength: 64,
      maxlength: 64,
    },
    payloadDigest: { type: String, required: true, minlength: 64, maxlength: 64 },
    fingerprintDigest: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
    gateway: { type: String, required: true, maxlength: 80 },
    maskedAccountNumber: { type: String, required: true, maxlength: 40 },
    transferType: { type: String, enum: ["in", "out"], required: true },
    amount: {
      type: Number,
      required: true,
      validate: Number.isSafeInteger,
      min: 1,
    },
    transactionAt: { type: Date, required: true },
    depositCode: { type: String, default: null, maxlength: 20 },
    depositRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DepositRequest",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: INCOMING_BANK_TRANSACTION_STATUSES,
      required: true,
      default: "received",
    },
    reviewReason: {
      type: String,
      enum: INCOMING_BANK_REVIEW_REASONS,
      default: null,
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
    reversalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

incomingBankTransactionSchema.index(
  { provider: 1, source: 1, providerTransactionId: 1 },
  { unique: true, name: "uniq_incoming_provider_source_transaction" },
);
incomingBankTransactionSchema.index(
  { provider: 1, canonicalReferenceHash: 1 },
  {
    unique: true,
    partialFilterExpression: { canonicalReferenceHash: { $type: "string" } },
    name: "uniq_incoming_provider_bank_reference",
  },
);
incomingBankTransactionSchema.index(
  { status: 1, createdAt: -1 },
  { name: "incoming_status_created" },
);
incomingBankTransactionSchema.index(
  { depositRequestId: 1, transactionAt: -1 },
  { name: "incoming_deposit_transaction_at" },
);
incomingBankTransactionSchema.index(
  { userId: 1, transactionAt: -1 },
  { name: "incoming_user_transaction_at" },
);

export default mongoose.model(
  "IncomingBankTransaction",
  incomingBankTransactionSchema,
);
