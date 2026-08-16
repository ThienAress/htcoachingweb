import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import ProviderSyncCursor from "../../models/ProviderSyncCursor.js";
import { resolveSePayConfig } from "../../config/sepay.js";
import { buildSePayAccountIdentityHash } from "../sepayReconciliation.service.js";
import { getSePayOperationalStatus } from "../sepayOperationalStatus.service.js";

const configuredEnv = () => ({
  SEPAY_ENABLED: "true",
  SEPAY_RECONCILIATION_ENABLED: "true",
  SEPAY_MODE: "sandbox",
  SEPAY_WEBHOOK_SECRET: "webhook-secret-value-with-at-least-32-bytes",
  SEPAY_DATA_HASH_SECRET: "data-hash-secret-value-with-at-least-32-bytes",
  SEPAY_API_TOKEN: "sandbox-api-token-value",
  SEPAY_AUTOMATION_CUTOVER_AT: "2026-08-15T00:00:00.000Z",
  BANK_ACCOUNT: "0000000000",
});

describe("SePay operational status", () => {
  beforeAll(setupTestDB);
  afterEach(() => ProviderSyncCursor.deleteMany({}));
  afterAll(teardownTestDB);

  it("reports disabled without requiring secrets", async () => {
    await expect(getSePayOperationalStatus({})).resolves.toMatchObject({
      configured: false,
      status: "disabled",
      lastErrorCode: null,
    });
  });

  it("reports only safe cursor health fields", async () => {
    const env = configuredEnv();
    const config = resolveSePayConfig(env);
    await ProviderSyncCursor.create({
      provider: "sepay",
      accountIdentityHash: buildSePayAccountIdentityHash(config),
      lastRunAt: new Date("2026-08-15T04:00:00.000Z"),
      lastSuccessAt: new Date("2026-08-15T03:55:00.000Z"),
      lastErrorCode: "SEPAY_API_RATE_LIMITED",
    });

    const result = await getSePayOperationalStatus(env);

    expect(result).toEqual({
      configured: true,
      status: "degraded",
      reconciliationEnabled: true,
      lastRunAt: new Date("2026-08-15T04:00:00.000Z"),
      lastSuccessAt: new Date("2026-08-15T03:55:00.000Z"),
      lastErrorCode: "SEPAY_API_RATE_LIMITED",
    });
    expect(JSON.stringify(result)).not.toContain(env.BANK_ACCOUNT);
    expect(JSON.stringify(result)).not.toContain(env.SEPAY_API_TOKEN);
  });
});
