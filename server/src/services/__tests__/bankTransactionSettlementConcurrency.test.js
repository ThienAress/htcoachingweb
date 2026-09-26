import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
import { reverseIncomingBankTransaction } from "../adminIncomingBankTransaction.service.js";
import { processIncomingBankTransaction } from "../bankTransactionSettlement.service.js";

const config = { cutoverAt: new Date("2026-08-15T00:00:00.000Z") };

const createConcurrentFixture = async (overrides = [{}, {}]) => {
  const { user } = await createTestUser();
  await Wallet.create({ userId: user._id, balance: 0, version: 0 });
  const deposit = await DepositRequest.create({
    userId: user._id,
    amount: 150000,
    depositCode: "HTC-AB12-CD34",
    status: "pending",
    createdAt: new Date("2026-08-15T02:30:00.000Z"),
    expiresAt: new Date("2026-08-15T03:20:00.000Z"),
  });
  // Both channels have already passed ingestion before either settlement starts.
  const incoming = await IncomingBankTransaction.create(
    overrides.map((override, index) => ({
      provider: "sepay",
      source: index === 0 ? "webhook" : "reconciliation",
      providerTransactionId: `concurrent-${index}`,
      canonicalReferenceHash: null,
      payloadDigest: "a".repeat(64),
      fingerprintDigest: "b".repeat(64),
      gateway: "TPBank",
      maskedAccountNumber: "******0000",
      transferType: "in",
      amount: 150000,
      transactionAt: new Date("2026-08-15T03:00:00.000Z"),
      depositCode: deposit.depositCode,
      status: "received",
      ...override,
    })),
  );
  return { user, deposit, incoming };
};

const settleTogether = (incoming) => Promise.all(
  incoming.map(({ _id }) => processIncomingBankTransaction({ incomingId: _id, config })),
);

describe("SePay concurrent cross-channel settlement", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all([
      DepositRequest.init(), IncomingBankTransaction.init(),
      Wallet.init(), WalletTransaction.init(),
    ]);
  });
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("credits once and holds the ambiguous no-reference peer for review", async () => {
    const { user, deposit, incoming } = await createConcurrentFixture();

    await settleTogether(incoming);
    const replay = await settleTogether(incoming);

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean()).balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      incomingCount: await IncomingBankTransaction.countDocuments(),
      settledCount: await IncomingBankTransaction.countDocuments({ status: "settled" }),
      reviewCount: await IncomingBankTransaction.countDocuments({
        status: "needs_review",
        reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE",
        depositRequestId: deposit._id,
        userId: user._id,
      }),
      replaySkipped: replay.every(({ skipped }) => skipped),
    }).toEqual({
      balance: 150000, ledgerCount: 1, incomingCount: 2, settledCount: 1, reviewCount: 1,
      replaySkipped: true,
    });
  });

  it.each([
    ["different IDs in the same source", [{}, { source: "webhook" }]],
    ["distinct canonical references", [
      { canonicalReferenceHash: "c".repeat(64) },
      { canonicalReferenceHash: "d".repeat(64) },
    ]],
    ["distinct fingerprints across sources", [{}, { fingerprintDigest: "e".repeat(64) }]],
  ])("keeps two real transfers with %s separate", async (_label, overrides) => {
    const { user, incoming } = await createConcurrentFixture(overrides);

    await settleTogether(incoming);

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean()).balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      incomingCount: await IncomingBankTransaction.countDocuments(),
      settledCount: await IncomingBankTransaction.countDocuments({ status: "settled" }),
    }).toEqual({ balance: 300000, ledgerCount: 2, incomingCount: 2, settledCount: 2 });
  });

  it("does not re-credit the cross-channel copy after the winner is reversed", async () => {
    const { user, incoming } = await createConcurrentFixture();
    await processIncomingBankTransaction({ incomingId: incoming[0]._id, config });
    await reverseIncomingBankTransaction({
      incomingId: incoming[0]._id,
      reason: "Synthetic duplicate review",
      actor: { id: user._id, role: "admin" },
    });

    const result = await processIncomingBankTransaction({ incomingId: incoming[1]._id, config });

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean()).balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      result,
    }).toEqual({
      balance: 0,
      ledgerCount: 2,
      result: { status: "needs_review", reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE", skipped: false },
    });
  });

  it("treats a legacy missing reference as no reference without rewriting it", async () => {
    const { user, incoming } = await createConcurrentFixture();
    await IncomingBankTransaction.collection.updateOne(
      { _id: incoming[0]._id }, { $unset: { canonicalReferenceHash: "" } },
    );
    await processIncomingBankTransaction({ incomingId: incoming[0]._id, config });

    const result = await processIncomingBankTransaction({ incomingId: incoming[1]._id, config });

    expect({
      balance: (await Wallet.findOne({ userId: user._id }).lean()).balance,
      ledgerCount: await WalletTransaction.countDocuments(),
      legacyReference: (await IncomingBankTransaction.collection.findOne({ _id: incoming[0]._id })).canonicalReferenceHash,
      result,
    }).toEqual({
      balance: 150000,
      ledgerCount: 1,
      legacyReference: undefined,
      result: { status: "needs_review", reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE", skipped: false },
    });
  });
});
