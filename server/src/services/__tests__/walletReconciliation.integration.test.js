import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { clearCollections, setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import { reconcileWallets } from "../walletReconciliation.service.js";

const objectId = () => new mongoose.Types.ObjectId();

const createFitnessSubscription = (overrides = {}) =>
  FitnessSubscription.create({
    userId: objectId(),
    planCode: "fitness_plus_essential",
    planTitle: "Nền tảng",
    billingCycle: "month",
    source: "self_purchase",
    amount: 100,
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-10-01T00:00:00.000Z"),
    status: "expired",
    isActive: false,
    purchaseRequestId: "purchase-request-1",
    ...overrides,
  });

const createWalletWithLedger = async ({
  userId,
  subscriptionId,
  purchaseRequestId,
  purchaseAmount = -100,
  purchaseUserId = userId,
  idempotencyKey = `fitness-plus:${userId}:${purchaseRequestId}`,
} = {}) => {
  const wallet = await Wallet.create({ userId, balance: 200 + purchaseAmount });
  await WalletTransaction.create({
    userId,
    walletId: wallet._id,
    type: "deposit",
    amount: 200,
    balanceBefore: 0,
    balanceAfter: 200,
    status: "success",
    referenceType: "adjustment",
    referenceId: objectId(),
    idempotencyKey: `test-credit:${wallet._id}`,
  });
  const purchase = await WalletTransaction.create({
    userId: purchaseUserId,
    walletId: wallet._id,
    type: "purchase",
    amount: purchaseAmount,
    balanceBefore: 200,
    balanceAfter: 200 + purchaseAmount,
    status: "success",
    referenceType: "fitness_subscription",
    referenceId: subscriptionId,
    idempotencyKey,
  });
  return { wallet, purchase };
};

describe("wallet reconciliation snapshot and Fitness+ coverage", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("reports a valid Fitness+ self-purchase as clean", async () => {
    const subscription = await createFitnessSubscription();
    await createWalletWithLedger({
      userId: subscription.userId,
      subscriptionId: subscription._id,
      purchaseRequestId: subscription.purchaseRequestId,
    });

    const report = await reconcileWallets();

    expect(report).toMatchObject({
      totalIssues: 0,
      coverageComplete: true,
      checkedFitnessSubscriptions: 1,
      consistency: {
        mode: "snapshot_transaction",
        readConcern: "snapshot",
        fitnessAdminGrantsExcluded: 0,
      },
    });
  });

  it("distinguishes a missing Fitness+ ledger from a wrong amount", async () => {
    const missing = await createFitnessSubscription({ purchaseRequestId: "missing-ledger" });
    const wrong = await createFitnessSubscription({
      userId: objectId(),
      purchaseRequestId: "wrong-amount",
    });
    await createWalletWithLedger({
      userId: wrong.userId,
      subscriptionId: wrong._id,
      purchaseRequestId: wrong.purchaseRequestId,
      purchaseAmount: -99,
    });

    const codes = (await reconcileWallets()).issues.map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "FITNESS_SUBSCRIPTION_LEDGER_MISSING",
        "FITNESS_SUBSCRIPTION_LEDGER_AMOUNT_MISMATCH",
      ]),
    );
    expect(String(missing._id)).not.toBe(String(wrong._id));
  });

  it("detects a successful orphan Fitness+ purchase ledger", async () => {
    const userId = objectId();
    await createWalletWithLedger({
      userId,
      subscriptionId: objectId(),
      purchaseRequestId: "orphan-request",
    });

    const report = await reconcileWallets();

    expect(report.issues.map((issue) => issue.code)).toContain(
      "FITNESS_SUBSCRIPTION_LEDGER_ORPHAN",
    );
  });

  it("reports Fitness+ ledger user and idempotency mismatches independently", async () => {
    const subscription = await createFitnessSubscription({
      purchaseRequestId: "identity-mismatch",
    });
    await createWalletWithLedger({
      userId: subscription.userId,
      subscriptionId: subscription._id,
      purchaseRequestId: subscription.purchaseRequestId,
      purchaseUserId: objectId(),
      idempotencyKey: "fitness-plus:wrong-user:identity-mismatch",
    });

    const codes = (await reconcileWallets()).issues.map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "FITNESS_SUBSCRIPTION_LEDGER_USER_MISMATCH",
        "FITNESS_SUBSCRIPTION_LEDGER_IDEMPOTENCY_MISMATCH",
      ]),
    );
  });

  it("excludes and counts Fitness+ admin grants without guessing ledger semantics", async () => {
    await createFitnessSubscription({
      source: "admin_grant",
      amount: 0,
      purchaseRequestId: null,
    });

    const report = await reconcileWallets();

    expect(report).toMatchObject({
      totalIssues: 0,
      checkedFitnessSubscriptions: 1,
      consistency: { fitnessAdminGrantsExcluded: 1 },
    });
  });

  it("marks limit+1 scope detection as incomplete even when retained records are clean", async () => {
    await Wallet.create([
      { userId: objectId(), balance: 0 },
      { userId: objectId(), balance: 0 },
    ]);

    const report = await reconcileWallets({ walletLimit: 1 });

    expect(report).toMatchObject({
      coverageComplete: false,
      checkedWallets: 1,
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RECONCILIATION_SCOPE_TRUNCATED",
          scope: "wallets",
        }),
      ]),
    );
  });

  it("keeps one stable snapshot while a concurrent wallet write commits", async () => {
    const userId = objectId();
    const wallet = await Wallet.create({ userId, balance: 0 });
    const session = await mongoose.startSession();
    session.startTransaction({ readConcern: { level: "snapshot" } });
    await Wallet.findById(wallet._id).session(session).lean();

    try {
      await Wallet.collection.updateOne(
        { _id: wallet._id },
        { $set: { balance: 1 } },
      );
      await WalletTransaction.create({
        userId,
        walletId: wallet._id,
        type: "deposit",
        amount: 1,
        balanceBefore: 0,
        balanceAfter: 1,
        status: "success",
        referenceType: "adjustment",
        referenceId: objectId(),
        idempotencyKey: `snapshot-test:${wallet._id}`,
      });

      const report = await reconcileWallets({ session });

      expect(report.totalIssues).toBe(0);
    } finally {
      await session.abortTransaction();
      await session.endSession();
    }
  });

  it("rejects a caller session that is not an active snapshot transaction", async () => {
    const session = await mongoose.startSession();
    try {
      await expect(reconcileWallets({ session })).rejects.toMatchObject({
        code: "RECONCILIATION_SNAPSHOT_REQUIRED",
      });
    } finally {
      await session.endSession();
    }
  });
});
