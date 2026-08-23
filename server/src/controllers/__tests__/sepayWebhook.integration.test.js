import crypto from "crypto";
import express from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import DepositRequest from "../../models/DepositRequest.js";
import IncomingBankTransaction from "../../models/IncomingBankTransaction.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import sepayWebhookRoutes from "../../routes/sepayWebhook.routes.js";
import { reconcileWallets } from "../../services/walletReconciliation.service.js";

const WEBHOOK_SECRET = "test-sepay-webhook-secret-with-32-bytes";
const DATA_HASH_SECRET = "test-sepay-data-hash-secret-with-32-bytes";

const payload = {
  id: 92704,
  gateway: "TPBank",
  transactionDate: "2026-08-15 10:30:00",
  accountNumber: "0000000000",
  code: "HTC-AB12-CD34",
  content: "HTC-AB12-CD34 chuyen tien",
  transferType: "in",
  transferAmount: 150000,
  referenceCode: "FT260815ABC",
};

const signedRequest = (app, body, { timestamp = Math.floor(Date.now() / 1000) } = {}) => {
  const rawBody = JSON.stringify(body);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return request(app)
    .post("/api/webhooks/sepay")
    .set("Content-Type", "application/json")
    .set("X-SePay-Timestamp", String(timestamp))
    .set("X-SePay-Signature", `sha256=${signature}`)
    .send(rawBody);
};

const createDepositFixture = async ({
  amount = 150000,
  depositCode = "HTC-AB12-CD34",
  createdAt = new Date("2026-08-15T02:30:00.000Z"),
  expiresAt = new Date("2026-08-15T03:20:00.000Z"),
} = {}) => {
  const { user } = await createTestUser();
  await Wallet.create({ userId: user._id, balance: 0, version: 0 });
  const deposit = await DepositRequest.create({
    userId: user._id,
    amount,
    depositCode,
    expiresAt,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  });
  return { user, deposit };
};

describe("POST /api/webhooks/sepay", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = express();
    app.use("/api/webhooks/sepay", sepayWebhookRoutes);
    app.use(express.json());
  });

  beforeEach(() => {
    process.env.SEPAY_ENABLED = "true";
    process.env.SEPAY_MODE = "sandbox";
    process.env.SEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SEPAY_DATA_HASH_SECRET = DATA_HASH_SECRET;
    process.env.SEPAY_AUTOMATION_CUTOVER_AT = "2026-08-15T00:00:00.000Z";
    process.env.BANK_ACCOUNT = "0000000000";
  });

  afterEach(async () => {
    await clearCollections();
    delete process.env.SEPAY_ENABLED;
    delete process.env.SEPAY_MODE;
    delete process.env.SEPAY_WEBHOOK_SECRET;
    delete process.env.SEPAY_DATA_HASH_SECRET;
    delete process.env.SEPAY_AUTOMATION_CUTOVER_AT;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("durably stores one masked incoming transaction", async () => {
    const response = await signedRequest(app, payload);
    const stored = await IncomingBankTransaction.findOne().lean();

    expect({
      status: response.status,
      success: response.body.success,
      count: await IncomingBankTransaction.countDocuments(),
      stored: {
        status: stored?.status,
        amount: stored?.amount,
        account: stored?.maskedAccountNumber,
        code: stored?.depositCode,
        hasRawContent: Object.hasOwn(stored || {}, "content"),
      },
    }).toEqual({
      status: 200,
      success: true,
      count: 1,
      stored: {
        status: "needs_review",
        amount: 150000,
        account: "******0000",
        code: "HTC-AB12-CD34",
        hasRawContent: false,
      },
    });
  });

  it("acknowledges a replay without storing a second transaction", async () => {
    await signedRequest(app, payload);
    const replay = await signedRequest(app, payload);

    expect({
      status: replay.status,
      success: replay.body.success,
      count: await IncomingBankTransaction.countDocuments(),
    }).toEqual({ status: 200, success: true, count: 1 });
  });

  it("rejects an invalid signature before any database write", async () => {
    const response = await request(app)
      .post("/api/webhooks/sepay")
      .set("Content-Type", "application/json")
      .set("X-SePay-Timestamp", String(Math.floor(Date.now() / 1000)))
      .set("X-SePay-Signature", `sha256=${"0".repeat(64)}`)
      .send(JSON.stringify(payload));

    expect({
      status: response.status,
      code: response.body.code,
      count: await IncomingBankTransaction.countDocuments(),
    }).toEqual({ status: 401, code: "INVALID_SIGNATURE", count: 0 });
  });

  it("fails closed when the webhook secret is missing", async () => {
    delete process.env.SEPAY_WEBHOOK_SECRET;

    const response = await signedRequest(app, payload);

    expect({
      status: response.status,
      code: response.body.code,
      count: await IncomingBankTransaction.countDocuments(),
    }).toEqual({ status: 503, code: "WEBHOOK_NOT_CONFIGURED", count: 0 });
  });

  it("settles an exact code and amount through the append-only wallet ledger", async () => {
    const { user, deposit } = await createDepositFixture();

    const response = await signedRequest(app, payload);
    const incoming = await IncomingBankTransaction.findOne().lean();
    const wallet = await Wallet.findOne({ userId: user._id }).lean();
    const ledger = await WalletTransaction.findOne().lean();

    expect({
      httpStatus: response.status,
      incomingStatus: incoming?.status,
      depositId: incoming?.depositRequestId?.toString(),
      depositStatus: (await DepositRequest.findById(deposit._id).lean())?.status,
      balance: wallet?.balance,
      ledger: {
        count: await WalletTransaction.countDocuments(),
        amount: ledger?.amount,
        referenceType: ledger?.referenceType,
        referenceId: ledger?.referenceId?.toString(),
      },
    }).toEqual({
      httpStatus: 200,
      incomingStatus: "settled",
      depositId: deposit._id.toString(),
      depositStatus: "success",
      balance: 150000,
      ledger: {
        count: 1,
        amount: 150000,
        referenceType: "incoming_bank_transaction",
        referenceId: incoming?._id.toString(),
      },
    });
  });

  it("settles when TPBank removes separators from the deposit code", async () => {
    const { user } = await createDepositFixture({
      amount: 5000,
      depositCode: "HTC-E445-DDDC",
    });

    await signedRequest(app, {
      ...payload,
      code: null,
      content: "HTCE445DDDC FT26231604698561",
      transferAmount: 5000,
    });

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      incomingStatus: (await IncomingBankTransaction.findOne().lean())?.status,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({ balance: 5000, incomingStatus: "settled", ledgerCount: 1 });
  });

  it("does not credit the same provider transaction again on webhook replay", async () => {
    const { user } = await createDepositFixture();

    await signedRequest(app, payload);
    await signedRequest(app, payload);

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      incomingCount: await IncomingBankTransaction.countDocuments(),
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({ balance: 150000, incomingCount: 1, ledgerCount: 1 });
  });

  it("credits two distinct real transactions even when code and amount match", async () => {
    const { user } = await createDepositFixture();
    const second = {
      ...payload,
      id: 92705,
      referenceCode: "FT260815DEF",
      transactionDate: "2026-08-15 10:31:00",
    };

    await signedRequest(app, payload);
    await signedRequest(app, second);
    const reconciliation = await reconcileWallets();

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      incomingCount: await IncomingBankTransaction.countDocuments({
        status: "settled",
      }),
      ledgerCount: await WalletTransaction.countDocuments({ type: "deposit" }),
      reconciliationIssues: reconciliation.totalIssues,
    }).toEqual({
      balance: 300000,
      incomingCount: 2,
      ledgerCount: 2,
      reconciliationIssues: 0,
    });
  });

  it("keeps an amount mismatch in review without changing the wallet", async () => {
    const { user } = await createDepositFixture();

    await signedRequest(app, { ...payload, transferAmount: 149000 });
    const incoming = await IncomingBankTransaction.findOne().lean();

    expect({
      status: incoming?.status,
      reason: incoming?.reviewReason,
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({
      status: "needs_review",
      reason: "AMOUNT_MISMATCH",
      balance: 0,
      ledgerCount: 0,
    });
  });

  it("does not auto-credit content containing multiple deposit codes", async () => {
    const { user } = await createDepositFixture();

    await signedRequest(app, {
      ...payload,
      code: null,
      content: "HTC-AB12-CD34 HTC-EF56-7890 chuyen tien",
    });
    const incoming = await IncomingBankTransaction.findOne().lean();

    expect({
      status: incoming?.status,
      reason: incoming?.reviewReason,
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({
      status: "needs_review",
      reason: "CODE_MISMATCH_OR_AMBIGUOUS",
      balance: 0,
      ledgerCount: 0,
    });
  });

  it("keeps a transaction beyond the 24-hour expiry grace in review", async () => {
    process.env.SEPAY_AUTOMATION_CUTOVER_AT = "2026-08-01T00:00:00.000Z";
    const { user } = await createDepositFixture({
      createdAt: new Date("2026-08-13T02:30:00.000Z"),
      expiresAt: new Date("2026-08-14T02:30:00.000Z"),
    });

    await signedRequest(app, payload);
    const incoming = await IncomingBankTransaction.findOne().lean();

    expect({
      status: incoming?.status,
      reason: incoming?.reviewReason,
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
    }).toEqual({
      status: "needs_review",
      reason: "OUTSIDE_AUTO_SETTLEMENT_WINDOW",
      balance: 0,
    });
  });

  it("does not auto-credit a deposit created before the automation cutover", async () => {
    const { user } = await createDepositFixture({
      createdAt: new Date("2026-08-14T02:30:00.000Z"),
      expiresAt: new Date("2026-08-15T03:20:00.000Z"),
    });

    await signedRequest(app, payload);
    const incoming = await IncomingBankTransaction.findOne().lean();

    expect({
      status: incoming?.status,
      reason: incoming?.reviewReason,
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
    }).toEqual({
      status: "needs_review",
      reason: "PRE_CUTOVER_DEPOSIT",
      balance: 0,
    });
  });
});
