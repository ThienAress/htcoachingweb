import mongoose from "mongoose";

const providerSyncCursorSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["sepay"], required: true },
    accountIdentityHash: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
    lastTransactionId: { type: String, default: null, maxlength: 100 },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: null, maxlength: 100 },
    leaseOwner: { type: String, default: null, maxlength: 100 },
    leaseExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

providerSyncCursorSchema.index(
  { provider: 1, accountIdentityHash: 1 },
  { unique: true, name: "uniq_provider_sync_cursor_account" },
);
providerSyncCursorSchema.index(
  { leaseExpiresAt: 1 },
  { name: "provider_sync_cursor_lease_expiry" },
);

export default mongoose.model("ProviderSyncCursor", providerSyncCursorSchema);
