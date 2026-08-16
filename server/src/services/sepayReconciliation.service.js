import crypto from "crypto";

import { requireSePayReconciliationConfig } from "../config/sepay.js";
import ProviderSyncCursor from "../models/ProviderSyncCursor.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import { ingestBankTransaction } from "./bankTransactionIngestion.service.js";
import { processIncomingBankTransaction } from "./bankTransactionSettlement.service.js";
import { normalizeSePayApiTransaction } from "./sepayBankTransaction.provider.js";
import { fetchSePayTransactions } from "./sepayTransactionApi.provider.js";

const PROVIDER = "sepay";
const WEBHOOK_RACE_DELAY_MS = 10 * 60 * 1000;
const LEASE_DURATION_MS = 2 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 334;
const wait = (milliseconds) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });

export const buildSePayAccountIdentityHash = (config) =>
  crypto
    .createHmac("sha256", config.dataHashSecret)
    .update(`${PROVIDER}:${config.accountNumber}`)
    .digest("hex");

const acquireCursor = async ({ config, now, owner }) => {
  const identityHash = buildSePayAccountIdentityHash(config);
  try {
    await ProviderSyncCursor.updateOne(
      { provider: PROVIDER, accountIdentityHash: identityHash },
      { $setOnInsert: { provider: PROVIDER, accountIdentityHash: identityHash } },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  return ProviderSyncCursor.findOneAndUpdate(
    {
      provider: PROVIDER,
      accountIdentityHash: identityHash,
      $or: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { $lte: now } },
        { leaseOwner: owner },
      ],
    },
    {
      $set: {
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
        lastRunAt: now,
      },
    },
    { returnDocument: "after" },
  );
};

const releaseCursor = async ({ cursorId, owner, now, errorCode = null }) => {
  await ProviderSyncCursor.updateOne(
    { _id: cursorId, leaseOwner: owner },
    {
      $set: {
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode,
        ...(errorCode ? {} : { lastSuccessAt: now }),
      },
    },
  );
};

export const runSePayReconciliation = async ({
  fetchImpl = globalThis.fetch,
  now = new Date(),
  waitImpl = wait,
} = {}) => {
  const config = requireSePayReconciliationConfig(process.env);
  const owner = crypto.randomUUID();
  const cursor = await acquireCursor({ config, now, owner });
  if (!cursor) return { imported: 0, processed: 0, deferred: 0, locked: true };

  let imported = 0;
  let processed = 0;
  let deferred = 0;
  let lastTransactionId = cursor.lastTransactionId;
  try {
    let page = 1;
    let shouldContinue = true;
    while (shouldContinue) {
      const result = await fetchSePayTransactions({
        config,
        sinceId: cursor.lastTransactionId,
        page,
        fetchImpl,
      });
      for (const payload of result.transactions) {
        const transaction = normalizeSePayApiTransaction(payload);
        if (now.getTime() - transaction.transactionAt.getTime() < WEBHOOK_RACE_DELAY_MS) {
          deferred += 1;
          shouldContinue = false;
          break;
        }
        const ingested = await ingestBankTransaction({ transaction, config });
        if (!ingested.duplicate) imported += 1;
        await processIncomingBankTransaction({
          incomingId: ingested.incoming._id,
          config,
        });
        processed += 1;
        lastTransactionId = transaction.providerTransactionId;
        await ProviderSyncCursor.updateOne(
          { _id: cursor._id, leaseOwner: owner },
          {
            $set: {
              lastTransactionId,
              leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
            },
          },
        );
      }
      shouldContinue =
        shouldContinue && result.pagination.hasMore && page < result.pagination.lastPage;
      if (shouldContinue) await waitImpl(MIN_REQUEST_INTERVAL_MS);
      page += 1;
    }
    if (imported > 0) {
      incrementMetric("financial.sepay_reconciliation_imported", imported);
    }
    await releaseCursor({ cursorId: cursor._id, owner, now });
    return { imported, processed, deferred, locked: false, lastTransactionId };
  } catch (error) {
    incrementMetric("financial.sepay_reconciliation_failures");
    safeLog.error("financial.sepay_reconciliation_failed", error, {
      provider: PROVIDER,
      errorCode: error?.code || "UNKNOWN_ERROR",
    });
    await releaseCursor({
      cursorId: cursor._id,
      owner,
      now,
      errorCode: String(error?.code || "UNKNOWN_ERROR").slice(0, 100),
    });
    throw error;
  }
};
