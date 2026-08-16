import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
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
import { ingestBankTransaction } from "../bankTransactionIngestion.service.js";
import { processIncomingBankTransaction } from "../bankTransactionSettlement.service.js";
import { normalizeSePayWebhook } from "../sepayBankTransaction.provider.js";
import { applyWalletEntry } from "../walletLedger.service.js";

describe("SePay settlement after legacy manual approval", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("holds an incoming transaction for review when a legacy credit is active", async () => {
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
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyWalletEntry({
          session,
          userId: user._id,
          amount: deposit.amount,
          type: "deposit",
          referenceType: "deposit_request",
          referenceId: deposit._id,
          idempotencyKey: `deposit:${deposit._id}`,
        });
        deposit.status = "success";
        deposit.isOpen = false;
        await deposit.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const config = {
      accountNumber: "0000000000",
      dataHashSecret: "test-sepay-data-hash-secret-with-32-bytes",
      cutoverAt: new Date("2026-08-15T00:00:00.000Z"),
    };
    const transaction = normalizeSePayWebhook({
      id: 92707,
      gateway: "TPBank",
      transactionDate: "2026-08-15 10:30:00",
      accountNumber: config.accountNumber,
      code: deposit.depositCode,
      content: `${deposit.depositCode} chuyen tien`,
      transferType: "in",
      transferAmount: deposit.amount,
      referenceCode: "FT260815LEGACY",
    });
    const ingested = await ingestBankTransaction({ transaction, config });

    await processIncomingBankTransaction({
      incomingId: ingested.incoming._id,
      config,
    });
    const incoming = await IncomingBankTransaction.findById(
      ingested.incoming._id,
    ).lean();

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean())?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      incomingStatus: incoming?.status,
      reviewReason: incoming?.reviewReason,
    }).toEqual({
      balance: 150000,
      ledgerCount: 1,
      incomingStatus: "needs_review",
      reviewReason: "POSSIBLE_LEGACY_MANUAL_CREDIT",
    });
  });
});
