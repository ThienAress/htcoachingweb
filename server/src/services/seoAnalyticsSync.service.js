import crypto from "node:crypto";

import AnalyticsSyncState from "../models/AnalyticsSyncState.js";
import SeoDailyMetric from "../models/SeoDailyMetric.js";
import { safeLog } from "../utils/safeLogger.js";

const DEFAULT_LOCK_MS = 120_000;
const ERROR_MESSAGES = Object.freeze({
  PROVIDER_TIMEOUT: "Provider không phản hồi kịp",
  MALFORMED_RESPONSE: "Provider trả dữ liệu không hợp lệ",
  PROVIDER_ERROR: "Provider tạm thời không khả dụng",
  INVALID_CONFIG: "Provider chưa được cấu hình đúng",
});

export class AnalyticsSyncError extends Error {
  constructor(code, message, provider) {
    super(message);
    this.name = "AnalyticsSyncError";
    this.code = code;
    this.provider = provider;
  }
}

const ensureSyncState = (provider) =>
  AnalyticsSyncState.updateOne(
    { provider },
    { $setOnInsert: { provider, status: "idle" } },
    { upsert: true },
  );

const validateRows = async (rows, provider, syncedAt) => {
  if (!Array.isArray(rows) || rows.length > 100_000) {
    throw new AnalyticsSyncError("MALFORMED_RESPONSE", "Provider trả quá nhiều rows", provider);
  }
  await Promise.all(
    rows.map((row) =>
      new SeoDailyMetric({ ...row, provider, syncedAt }).validate(),
    ),
  );
};

const writeRows = async (rows, provider, syncedAt) => {
  if (rows.length === 0) return 0;
  await SeoDailyMetric.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: {
          provider,
          dateKey: row.dateKey,
          dimension: row.dimension,
          dimensionKey: row.dimensionKey,
          contentPath: row.contentPath || "",
        },
        update: {
          $set: { metrics: row.metrics, syncedAt },
          $setOnInsert: {
            provider,
            dateKey: row.dateKey,
            dimension: row.dimension,
            dimensionKey: row.dimensionKey,
            contentPath: row.contentPath || "",
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return rows.length;
};

export const createSeoAnalyticsSyncService = ({
  providers,
  now = () => new Date(),
  createLockOwner = () => crypto.randomUUID(),
  lockDurationMs = DEFAULT_LOCK_MS,
}) => ({
  async syncProvider(providerName, { startDate, endDate }) {
    const provider = providers[providerName];
    if (!provider) {
      throw new AnalyticsSyncError("UNKNOWN_PROVIDER", "Provider không được hỗ trợ", providerName);
    }
    if (!provider.configured) {
      await AnalyticsSyncState.findOneAndUpdate(
        { provider: providerName },
        {
          $set: {
            status: "disabled",
            windowStart: startDate,
            windowEnd: endDate,
            lockOwner: "",
            lockUntil: null,
          },
          $setOnInsert: { provider: providerName },
        },
        { upsert: true, returnDocument: "after" },
      );
      return { provider: providerName, status: "disabled", rowsWritten: 0 };
    }

    const startedAt = now();
    const lockOwner = createLockOwner();
    const lockUntil = new Date(startedAt.getTime() + lockDurationMs);
    await ensureSyncState(providerName);
    const locked = await AnalyticsSyncState.findOneAndUpdate(
      {
        provider: providerName,
        $or: [{ lockUntil: null }, { lockUntil: { $lte: startedAt } }],
      },
      {
        $set: {
          status: "running",
          windowStart: startDate,
          windowEnd: endDate,
          lastAttemptAt: startedAt,
          lockOwner,
          lockUntil,
          lastErrorCode: "",
          lastErrorMessage: "",
          lastErrorAt: null,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );
    if (!locked) {
      throw new AnalyticsSyncError(
        "SYNC_IN_PROGRESS",
        "Provider đang được đồng bộ",
        providerName,
      );
    }

    try {
      const result = await provider.fetchWindow({ startDate, endDate });
      const syncedAt = now();
      await validateRows(result.rows, providerName, syncedAt);
      const rowsWritten = await writeRows(result.rows, providerName, syncedAt);
      const status = result.partial ? "partial" : "success";
      await AnalyticsSyncState.updateOne(
        { provider: providerName, lockOwner },
        {
          $set: {
            status,
            cursor: 0,
            lastSuccessAt: syncedAt,
            lockOwner: "",
            lockUntil: null,
          },
        },
      );
      safeLog.info("seo_analytics.sync_completed", {
        provider: providerName,
        status,
        rowsWritten,
        durationMs: syncedAt.getTime() - startedAt.getTime(),
      });
      return { provider: providerName, status, rowsWritten };
    } catch (error) {
      const failedAt = now();
      const code = ERROR_MESSAGES[error?.code] ? error.code : "PROVIDER_ERROR";
      await AnalyticsSyncState.updateOne(
        { provider: providerName, lockOwner },
        {
          $set: {
            status: "error",
            lastErrorAt: failedAt,
            lastErrorCode: code,
            lastErrorMessage: ERROR_MESSAGES[code],
            lockOwner: "",
            lockUntil: null,
          },
        },
      );
      safeLog.warn("seo_analytics.sync_failed", "Provider sync failed", {
        provider: providerName,
        code,
        durationMs: failedAt.getTime() - startedAt.getTime(),
      });
      if (error?.code) throw error;
      throw new AnalyticsSyncError(code, ERROR_MESSAGES[code], providerName);
    }
  },
});
