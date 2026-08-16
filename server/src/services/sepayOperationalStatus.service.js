import {
  requireSePayReconciliationConfig,
  requireSePayWebhookConfig,
  resolveSePayConfig,
} from "../config/sepay.js";
import ProviderSyncCursor from "../models/ProviderSyncCursor.js";
import { buildSePayAccountIdentityHash } from "./sepayReconciliation.service.js";

export const getSePayOperationalStatus = async (env = process.env) => {
  const config = resolveSePayConfig(env);
  if (!config.enabled) {
    return {
      configured: false,
      status: "disabled",
      reconciliationEnabled: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorCode: null,
    };
  }
  try {
    requireSePayWebhookConfig(env);
    if (config.reconciliationEnabled) requireSePayReconciliationConfig(env);
  } catch (error) {
    return {
      configured: false,
      status: "misconfigured",
      reconciliationEnabled: config.reconciliationEnabled,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorCode: error.code || "SEPAY_CONFIG_INVALID",
    };
  }
  if (!config.reconciliationEnabled) {
    return {
      configured: true,
      status: "webhook_only",
      reconciliationEnabled: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorCode: null,
    };
  }
  const cursor = await ProviderSyncCursor.findOne({
    provider: "sepay",
    accountIdentityHash: buildSePayAccountIdentityHash(config),
  })
    .select("lastRunAt lastSuccessAt lastErrorCode")
    .lean();
  return {
    configured: true,
    status: cursor?.lastErrorCode
      ? "degraded"
      : cursor?.lastSuccessAt
        ? "ready"
        : "pending",
    reconciliationEnabled: true,
    lastRunAt: cursor?.lastRunAt || null,
    lastSuccessAt: cursor?.lastSuccessAt || null,
    lastErrorCode: cursor?.lastErrorCode || null,
  };
};
