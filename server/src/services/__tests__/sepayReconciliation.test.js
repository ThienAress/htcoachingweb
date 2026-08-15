import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import DepositRequest from "../../models/DepositRequest.js";
import IncomingBankTransaction from "../../models/IncomingBankTransaction.js";
import ProviderSyncCursor from "../../models/ProviderSyncCursor.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import { resolveSePayConfig } from "../../config/sepay.js";
import { ingestBankTransaction } from "../bankTransactionIngestion.service.js";
import { processIncomingBankTransaction } from "../bankTransactionSettlement.service.js";
import {
  fetchSePayTransactions,
} from "../sepayTransactionApi.provider.js";
import { normalizeSePayWebhook } from "../sepayBankTransaction.provider.js";
import { runSePayReconciliation } from "../sepayReconciliation.service.js";

const apiTransaction = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  transaction_date: "2026-08-15 10:30:00",
  account_number: "0000000000",
  transfer_type: "in",
  amount_in: 150000,
  transaction_content: "HTC-AB12-CD34 chuyen tien",
  reference_number: "FT260815ABC",
  code: "HTC-AB12-CD34",
  bank_brand_name: "TPBank",
  webhook_success: 0,
};

const apiResponse = (transactions = [apiTransaction], pagination = {}) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "content-type": "application/json" }),
  text: vi.fn().mockResolvedValue(
    JSON.stringify({
      status: "success",
      data: transactions,
      meta: {
        pagination: {
          total: transactions.length,
          per_page: 100,
          current_page: 1,
          last_page: 1,
          has_more: false,
          ...pagination,
        },
      },
    }),
  ),
});

const createDepositFixture = async () => {
  const { user } = await createTestUser();
  await Wallet.create({ userId: user._id, balance: 0, version: 0 });
  const deposit = await DepositRequest.create({
    userId: user._id,
    amount: 150000,
    depositCode: "HTC-AB12-CD34",
    expiresAt: new Date("2026-08-15T03:20:00.000Z"),
    status: "pending",
    createdAt: new Date("2026-08-15T02:30:00.000Z"),
    updatedAt: new Date("2026-08-15T02:30:00.000Z"),
  });
  return { user, deposit };
};

describe("SePay API v2 provider", () => {
  it("uses only the allowlisted sandbox host and bounded reconciliation filters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse());
    const config = {
      apiBaseUrl: "https://userapi-sandbox.sepay.vn/v2",
      apiToken: "sandbox-api-token-value",
      cutoverAt: new Date("2026-08-15T00:00:00.000Z"),
    };

    const result = await fetchSePayTransactions({
      config,
      sinceId: "cursor-uuid",
      fetchImpl,
    });
    const requestUrl = new URL(fetchImpl.mock.calls[0][0]);

    expect({
      origin: requestUrl.origin,
      path: requestUrl.pathname,
      sinceId: requestUrl.searchParams.get("since_id"),
      transferType: requestUrl.searchParams.get("transfer_type"),
      webhookSuccess: requestUrl.searchParams.get("webhook_success"),
      transactionDateFrom: requestUrl.searchParams.get("transaction_date_from"),
      perPage: requestUrl.searchParams.get("per_page"),
      resultId: result.transactions[0].id,
    }).toEqual({
      origin: "https://userapi-sandbox.sepay.vn",
      path: "/v2/transactions",
      sinceId: "cursor-uuid",
      transferType: "in",
      webhookSuccess: "0",
      transactionDateFrom: "2026-08-15 07:00:00",
      perPage: "100",
      resultId: apiTransaction.id,
    });
  });

  it("exposes the provider backoff without leaking the token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "2" }),
    });
    const config = {
      apiBaseUrl: "https://userapi-sandbox.sepay.vn/v2",
      apiToken: "sandbox-api-token-value",
      cutoverAt: new Date("2026-08-15T00:00:00.000Z"),
    };

    await expect(fetchSePayTransactions({ config, fetchImpl })).rejects.toMatchObject({
      code: "SEPAY_API_RATE_LIMITED",
      retryAfterMs: 2000,
    });
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url, { signal }) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          body: {
            getReader: () => ({
              read: () =>
                new Promise((_resolve, reject) => {
                  signal.addEventListener("abort", () => {
                    reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                  });
                }),
            }),
          },
        }),
      );
      const request = fetchSePayTransactions({
        config: {
          apiBaseUrl: "https://userapi-sandbox.sepay.vn/v2",
          apiToken: "sandbox-api-token-value",
          cutoverAt: new Date("2026-08-15T00:00:00.000Z"),
        },
        fetchImpl,
        timeoutMs: 50,
      });
      const rejection = expect(request).rejects.toMatchObject({
        code: "SEPAY_API_TIMEOUT",
      });

      await vi.advanceTimersByTimeAsync(51);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("runSePayReconciliation", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  beforeEach(() => {
    process.env.SEPAY_ENABLED = "true";
    process.env.SEPAY_RECONCILIATION_ENABLED = "true";
    process.env.SEPAY_MODE = "sandbox";
    process.env.SEPAY_WEBHOOK_SECRET = "test-sepay-webhook-secret-with-32-bytes";
    process.env.SEPAY_DATA_HASH_SECRET = "test-sepay-data-hash-secret-with-32-bytes";
    process.env.SEPAY_API_TOKEN = "sandbox-api-token-value";
    process.env.SEPAY_AUTOMATION_CUTOVER_AT = "2026-08-15T00:00:00.000Z";
    process.env.BANK_ACCOUNT = "0000000000";
  });

  afterEach(async () => {
    await clearCollections();
    for (const key of [
      "SEPAY_ENABLED",
      "SEPAY_RECONCILIATION_ENABLED",
      "SEPAY_MODE",
      "SEPAY_WEBHOOK_SECRET",
      "SEPAY_DATA_HASH_SECRET",
      "SEPAY_API_TOKEN",
      "SEPAY_AUTOMATION_CUTOVER_AT",
    ]) {
      delete process.env[key];
    }
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("recovers a missed webhook and resumes without a second credit", async () => {
    const { user } = await createDepositFixture();
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse());

    const first = await runSePayReconciliation({
      fetchImpl,
      now: new Date("2026-08-15T04:00:00.000Z"),
    });
    const second = await runSePayReconciliation({
      fetchImpl,
      now: new Date("2026-08-15T04:05:00.000Z"),
    });
    const cursor = await ProviderSyncCursor.findOne().lean();

    expect({
      firstImported: first.imported,
      secondImported: second.imported,
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      incomingCount: await IncomingBankTransaction.countDocuments(),
      ledgerCount: await WalletTransaction.countDocuments(),
      cursor: cursor?.lastTransactionId,
    }).toEqual({
      firstImported: 1,
      secondImported: 0,
      balance: 150000,
      incomingCount: 1,
      ledgerCount: 1,
      cursor: apiTransaction.id,
    });
  });

  it("does not auto-credit an ambiguous API copy when a no-reference webhook was already settled", async () => {
    const { user } = await createDepositFixture();
    const config = resolveSePayConfig(process.env);
    const webhook = normalizeSePayWebhook({
      id: 92704,
      gateway: "TPBank",
      transactionDate: apiTransaction.transaction_date,
      accountNumber: "0000000000",
      code: "HTC-AB12-CD34",
      content: apiTransaction.transaction_content,
      transferType: "in",
      transferAmount: 150000,
      referenceCode: "",
    });
    const ingested = await ingestBankTransaction({ transaction: webhook, config });
    await processIncomingBankTransaction({ incomingId: ingested.incoming._id });
    const noReferenceApi = {
      ...apiTransaction,
      reference_number: "",
    };

    await runSePayReconciliation({
      fetchImpl: vi.fn().mockResolvedValue(apiResponse([noReferenceApi])),
      now: new Date("2026-08-15T04:00:00.000Z"),
    });
    const review = await IncomingBankTransaction.findOne({
      source: "reconciliation",
    }).lean();

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      incomingCount: await IncomingBankTransaction.countDocuments(),
      reviewStatus: review?.status,
      reviewReason: review?.reviewReason,
    }).toEqual({
      balance: 150000,
      ledgerCount: 1,
      incomingCount: 2,
      reviewStatus: "needs_review",
      reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE",
    });
  });

  it("does not auto-credit a late no-reference webhook after the API copy settled", async () => {
    const { user } = await createDepositFixture();
    const noReferenceApi = { ...apiTransaction, reference_number: "" };
    await runSePayReconciliation({
      fetchImpl: vi.fn().mockResolvedValue(apiResponse([noReferenceApi])),
      now: new Date("2026-08-15T04:00:00.000Z"),
    });
    const config = resolveSePayConfig(process.env);
    const lateWebhook = normalizeSePayWebhook({
      id: 92706,
      gateway: "TPBank",
      transactionDate: apiTransaction.transaction_date,
      accountNumber: "0000000000",
      code: "HTC-AB12-CD34",
      content: apiTransaction.transaction_content,
      transferType: "in",
      transferAmount: 150000,
      referenceCode: "",
    });
    const ingested = await ingestBankTransaction({
      transaction: lateWebhook,
      config,
    });
    await processIncomingBankTransaction({
      incomingId: ingested.incoming._id,
      config,
    });
    const review = await IncomingBankTransaction.findOne({
      source: "webhook",
    }).lean();

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      incomingCount: await IncomingBankTransaction.countDocuments(),
      reviewStatus: review?.status,
      reviewReason: review?.reviewReason,
    }).toEqual({
      balance: 150000,
      ledgerCount: 1,
      incomingCount: 2,
      reviewStatus: "needs_review",
      reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE",
    });
  });

  it("does not advance the cursor past a transaction still inside the webhook race window", async () => {
    await createDepositFixture();
    const recent = {
      ...apiTransaction,
      transaction_date: "2026-08-15 10:55:00",
    };

    const result = await runSePayReconciliation({
      fetchImpl: vi.fn().mockResolvedValue(apiResponse([recent])),
      now: new Date("2026-08-15T04:00:00.000Z"),
    });
    const cursor = await ProviderSyncCursor.findOne().lean();

    expect({
      imported: result.imported,
      deferred: result.deferred,
      cursor: cursor?.lastTransactionId,
      incomingCount: await IncomingBankTransaction.countDocuments(),
    }).toEqual({ imported: 0, deferred: 1, cursor: null, incomingCount: 0 });
  });

  it("processes pagination sequentially and advances to the final durable transaction", async () => {
    const { user } = await createDepositFixture();
    const secondTransaction = {
      ...apiTransaction,
      id: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      transaction_date: "2026-08-15 10:31:00",
      reference_number: "FT260815DEF",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse([apiTransaction], {
          current_page: 1,
          last_page: 2,
          has_more: true,
        }),
      )
      .mockResolvedValueOnce(
        apiResponse([secondTransaction], {
          current_page: 2,
          last_page: 2,
          has_more: false,
        }),
      );
    const waitImpl = vi.fn().mockResolvedValue(undefined);

    const result = await runSePayReconciliation({
      fetchImpl,
      waitImpl,
      now: new Date("2026-08-15T04:00:00.000Z"),
    });

    expect({
      imported: result.imported,
      calls: fetchImpl.mock.calls.length,
      waitMs: waitImpl.mock.calls[0]?.[0],
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      cursor: (await ProviderSyncCursor.findOne().lean())?.lastTransactionId,
    }).toEqual({
      imported: 2,
      calls: 2,
      waitMs: 334,
      balance: 300000,
      cursor: secondTransaction.id,
    });
  });

  it("keeps the cursor at the last durable value when the API is unavailable", async () => {
    await expect(
      runSePayReconciliation({
        fetchImpl: vi.fn().mockRejectedValue(new Error("network down")),
        now: new Date("2026-08-15T04:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "SEPAY_API_UNAVAILABLE" });
    const cursor = await ProviderSyncCursor.findOne().lean();

    expect({
      cursor: cursor?.lastTransactionId,
      errorCode: cursor?.lastErrorCode,
    }).toEqual({ cursor: null, errorCode: "SEPAY_API_UNAVAILABLE" });
  });
});
