import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import depositRoutes from "../../routes/deposit.routes.js";
import adminDepositRoutes from "../../routes/adminDeposit.routes.js";
import trainerSubscriptionRoutes from "../../routes/trainerSubscription.routes.js";
import orderRoutes from "../../routes/order.routes.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import DepositRequest from "../../models/DepositRequest.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import Order from "../../models/Order.js";
import Checkin from "../../models/Checkin.js";
import Contract from "../../models/Contract.js";
import AuditLog from "../../models/AuditLog.js";
import { applyWalletEntry } from "../../services/walletLedger.service.js";
import { reconcileWallets } from "../../services/walletReconciliation.service.js";
import { deleteContract } from "../../services/contract.service.js";
import { runPhase6Migration } from "../../migrations/20260719-phase6-financial-integrity.js";

let app;

const postAs = (path, token, body = {}) =>
  withAuth(request(app).post(path).send(body), token);

const deleteAs = (path, token) =>
  withAuth(request(app).delete(path), token);

const fundWallet = async (userId, amount) => {
  await Wallet.create({ userId, balance: 0, version: 0 });
  const deposit = await DepositRequest.create({
    userId,
    amount,
    depositCode: "HTC-TEST-" + userId.toString().slice(-8),
    status: "success",
    expiresAt: new Date(Date.now() + 60000),
    paidAt: new Date(),
  });
  const session = await Wallet.startSession();
  try {
    await session.withTransaction(async () => {
      await applyWalletEntry({
        session,
        userId,
        amount,
        type: "deposit",
        referenceType: "deposit_request",
        referenceId: deposit._id,
        idempotencyKey: "test-funding:" + deposit._id.toString(),
      });
    });
  } finally {
    await session.endSession();
  }
  return deposit;
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/deposits", depositRoutes);
  app.use("/api/admin/deposits", adminDepositRoutes);
  app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);
  app.use("/api/orders", orderRoutes);
  await Promise.all([
    Wallet.init(),
    WalletTransaction.init(),
    DepositRequest.init(),
    TrainerSubscription.init(),
    Order.init(),
    Contract.init(),
  ]);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 6 financial state machines", () => {
  it("rejects non-integer and string deposit amounts", async () => {
    const actor = await createTestUser({
      email: "phase6-amount@example.com",
    });

    const decimal = await postAs("/api/deposits", actor.accessToken, {
      amount: 5000.5,
    });
    const stringAmount = await postAs("/api/deposits", actor.accessToken, {
      amount: "5000",
    });

    expect(decimal.status).toBe(400);
    expect(stringAmount.status).toBe(400);
    expect(await DepositRequest.countDocuments()).toBe(0);
  });

  it("approves once, blocks hard-delete, and reverses with an append-only entry", async () => {
    const actor = await createTestUser({
      email: "phase6-deposit-user@example.com",
    });
    const admin = await createTestUser({
      email: "phase6-deposit-admin@example.com",
      role: "admin",
    });

    const created = await postAs("/api/deposits", actor.accessToken, {
      amount: 50000,
    });
    const depositId = created.body.data.depositRequestId;

    const approved = await postAs(
      "/api/admin/deposits/" + depositId + "/approve",
      admin.accessToken,
    );
    const repeatedApproval = await postAs(
      "/api/admin/deposits/" + depositId + "/approve",
      admin.accessToken,
    );
    const deletePaid = await deleteAs(
      "/api/admin/deposits/" + depositId,
      admin.accessToken,
    );

    expect(approved.status).toBe(200);
    expect(repeatedApproval.status).toBe(200);
    expect(repeatedApproval.body.skipped).toBe(true);
    expect(deletePaid.status).toBe(409);
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(
      50000,
    );
    expect(
      await WalletTransaction.countDocuments({
        referenceId: depositId,
      }),
    ).toBe(1);

    const reversed = await postAs(
      "/api/admin/deposits/" + depositId + "/reverse",
      admin.accessToken,
      { reason: "Chuyển khoản được xác nhận nhầm" },
    );
    const repeatedReversal = await postAs(
      "/api/admin/deposits/" + depositId + "/reverse",
      admin.accessToken,
      { reason: "Chuyển khoản được xác nhận nhầm" },
    );

    const entries = await WalletTransaction.find({
      referenceId: depositId,
    }).sort({ createdAt: 1 });
    const deposit = await DepositRequest.findById(depositId);
    const wallet = await Wallet.findOne({ userId: actor.user._id });

    expect(reversed.status).toBe(200);
    expect(repeatedReversal.status).toBe(200);
    expect(repeatedReversal.body.skipped).toBe(true);
    expect(wallet.balance).toBe(0);
    expect(wallet.version).toBe(2);
    expect(deposit.status).toBe("reversed");
    expect(entries).toHaveLength(2);
    expect(entries[1].type).toBe("reversal");
    expect(entries[1].amount).toBe(-50000);
    expect(entries[1].reversalOf.toString()).toBe(entries[0]._id.toString());

    const report = await reconcileWallets();
    expect(report.totalIssues).toBe(0);

    await Wallet.collection.updateOne(
      { _id: wallet._id },
      { $set: { balance: 1 } },
    );
    const mismatch = await reconcileWallets();
    expect(
      mismatch.issues.some(
        (issue) => issue.code === "WALLET_BALANCE_MISMATCH",
      ),
    ).toBe(true);
  });

  it("charges a purchase request once and cancels without deleting its ledger", async () => {
    const actor = await createTestUser({
      email: "phase6-subscription-user@example.com",
    });
    const admin = await createTestUser({
      email: "phase6-subscription-admin@example.com",
      role: "admin",
    });
    await fundWallet(actor.user._id, 20000);
    const requestId = "11111111-1111-4111-8111-111111111111";
    const body = {
      planTitle: "Tiêu chuẩn",
      billingCycle: "month",
      requestId,
    };

    const purchased = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      body,
    );
    const repeated = await postAs(
      "/api/trainer-subscriptions/purchase",
      actor.accessToken,
      body,
    );

    expect(purchased.status).toBe(201);
    expect(repeated.status).toBe(200);
    expect(repeated.body.skipped).toBe(true);
    expect(
      await TrainerSubscription.countDocuments({
        userId: actor.user._id,
      }),
    ).toBe(1);
    expect(
      await WalletTransaction.countDocuments({
        referenceType: "trainer_subscription",
      }),
    ).toBe(1);
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(
      15000,
    );

    const subscription = await TrainerSubscription.findOne({
      userId: actor.user._id,
    });
    const cancelled = await postAs(
      "/api/trainer-subscriptions/" + subscription._id + "/cancel",
      admin.accessToken,
      { reason: "Admin chấm dứt quyền truy cập theo yêu cầu" },
    );
    const repeatedCancel = await postAs(
      "/api/trainer-subscriptions/" + subscription._id + "/cancel",
      admin.accessToken,
      { reason: "Admin chấm dứt quyền truy cập theo yêu cầu" },
    );

    const persisted = await TrainerSubscription.findById(subscription._id);
    expect(cancelled.status).toBe(200);
    expect(repeatedCancel.status).toBe(200);
    expect(repeatedCancel.body.skipped).toBe(true);
    expect(persisted.status).toBe("cancelled");
    expect(persisted.isActive).toBe(false);
    expect((await Wallet.findOne({ userId: actor.user._id })).balance).toBe(
      15000,
    );
    expect(
      await WalletTransaction.countDocuments({
        referenceType: "trainer_subscription",
      }),
    ).toBe(1);

    await expect(
      WalletTransaction.updateOne(
        { referenceType: "trainer_subscription" },
        { $set: { amount: 1 } },
      ),
    ).rejects.toThrow("append-only");
  });

  it("preserves orders and signed contracts once dependent records exist", async () => {
    const admin = await createTestUser({
      email: "phase6-order-admin@example.com",
      role: "admin",
    });
    const trainer = await createTestUser({
      email: "phase6-order-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "phase6-order-client@example.com",
    });
    const order = await Order.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      name: "Phase 6 Client",
      email: client.user.email,
      package: "Standard",
      sessions: 10,
      totalSessions: 10,
      status: "pending",
    });
    await Checkin.create({
      orderId: order._id,
      clientRequestId: "phase6-checkin-1",
      name: "Phase 6 Client",
      package: "Standard",
      time: new Date(),
      muscle: "Full body",
      remainingSessions: 9,
    });

    const blockedOrderDelete = await deleteAs(
      "/api/orders/" + order._id,
      admin.accessToken,
    );
    expect(blockedOrderDelete.status).toBe(409);
    expect(await Order.findById(order._id)).not.toBeNull();
    expect(await Checkin.countDocuments({ orderId: order._id })).toBe(1);

    await Checkin.deleteMany({ orderId: order._id });
    const deletedOrder = await deleteAs(
      "/api/orders/" + order._id,
      admin.accessToken,
    );
    expect(deletedOrder.status).toBe(200);
    expect(await Order.findById(order._id)).toBeNull();
    expect(
      await AuditLog.countDocuments({
        action: "delete_order",
        targetId: order._id,
      }),
    ).toBe(1);

    const signedOrder = await Order.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      name: "Signed Client",
      email: "signed-client@example.com",
      package: "Premium",
      sessions: 12,
      totalSessions: 12,
      status: "approved",
    });
    const signedContract = await Contract.create({
      orderId: signedOrder._id,
      clientId: client.user._id,
      trainerId: trainer.user._id,
      clientInfo: { name: "Signed Client" },
      status: "signed",
    });
    await expect(deleteContract(signedContract._id)).rejects.toThrow(
      "trạng thái nháp",
    );
    expect(await Contract.findById(signedContract._id)).not.toBeNull();

    const draftOrder = await Order.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      name: "Draft Client",
      email: "draft-client@example.com",
      package: "Basic",
      sessions: 8,
      totalSessions: 8,
      status: "pending",
    });
    const draftContract = await Contract.create({
      orderId: draftOrder._id,
      clientId: client.user._id,
      trainerId: trainer.user._id,
      clientInfo: { name: "Draft Client" },
      status: "draft",
    });
    await expect(deleteContract(draftContract._id)).resolves.toEqual({
      deleted: true,
    });
    expect(await Contract.findById(draftContract._id)).toBeNull();
  });

  it("runs the guarded migration logic idempotently on a clean replica set", async () => {
    const actor = await createTestUser({
      email: "phase6-migration-user@example.com",
    });
    await fundWallet(actor.user._id, 30000);

    const first = await runPhase6Migration();
    const second = await runPhase6Migration();

    expect(first.reconciliation.totalIssues).toBe(0);
    expect(second.reconciliation.totalIssues).toBe(0);
    expect(
      await WalletTransaction.countDocuments({
        userId: actor.user._id,
      }),
    ).toBe(1);
  });
});
