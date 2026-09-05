import request from "supertest";
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
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import adminDepositRoutes from "../../routes/adminDeposit.routes.js";
import AuditLog from "../../models/AuditLog.js";
import DepositRequest from "../../models/DepositRequest.js";
import IncomingBankTransaction from "../../models/IncomingBankTransaction.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import { reconcileWallets } from "../../services/walletReconciliation.service.js";

const digest = "a".repeat(64);

const createReviewFixture = async ({
  depositAmount = 150000,
  incomingAmount = 149000,
  snapshot = {},
  reviewReason = "AMOUNT_MISMATCH",
  suffix = "",
} = {}) => {
  const customer = await createTestUser({
    email: `incoming-customer-${Date.now()}@example.com`,
  });
  await Wallet.create({ userId: customer.user._id, balance: 0, version: 0 });
  const deposit = await DepositRequest.create({
    userId: customer.user._id,
    amount: depositAmount,
    depositCode: `HTC-AB12-${suffix || "CD34"}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    status: "pending",
    ...snapshot,
  });
  const incoming = await IncomingBankTransaction.create({
    provider: "sepay",
    source: "webhook",
    providerTransactionId: `provider-${Date.now()}`,
    sourceAliases: [
      { source: "webhook", providerTransactionId: `provider-${Date.now()}` },
    ],
    payloadDigest: digest,
    fingerprintDigest: "b".repeat(64),
    gateway: "TPBank",
    maskedAccountNumber: "******0000",
    transferType: "in",
    amount: incomingAmount,
    transactionAt: new Date(),
    depositCode: deposit.depositCode,
    depositRequestId: deposit._id,
    userId: customer.user._id,
    status: "needs_review",
    reviewReason,
  });
  return { customer, deposit, incoming };
};

describe("Admin incoming bank transaction review", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/admin/deposits", adminDepositRoutes);
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("returns a masked review queue only to admins", async () => {
    await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-list-admin@example.com",
      role: "admin",
    });
    const customer = await createTestUser({
      email: "incoming-list-user@example.com",
    });

    const denied = await withAuth(
      request(app).get("/api/admin/deposits/incoming"),
      customer.accessToken,
    );
    const allowed = await withAuth(
      request(app).get("/api/admin/deposits/incoming"),
      admin.accessToken,
    );
    const item = allowed.body.data.items[0];

    expect({
      denied: denied.status,
      allowed: allowed.status,
      count: allowed.body.data.pagination.total,
      maskedAccountNumber: item.maskedAccountNumber,
      hasProviderTransactionId: Object.hasOwn(item, "providerTransactionId"),
      hasPayloadDigest: Object.hasOwn(item, "payloadDigest"),
      creditedAmount: item.creditedAmount,
      bonusAmount: item.bonusAmount,
      hasLegacyFlag: Object.hasOwn(item.depositRequestId, "legacy"),
    }).toEqual({
      denied: 403,
      allowed: 200,
      count: 1,
      maskedAccountNumber: "******0000",
      hasProviderTransactionId: false,
      hasPayloadDigest: false,
      creditedAmount: 149000,
      bonusAmount: 0,
      hasLegacyFlag: false,
    });
  });

  it("approves the actual bank amount exactly once with an audit record", async () => {
    const { customer, deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-approve-admin@example.com",
      role: "admin",
    });
    const path = `/api/admin/deposits/incoming/${incoming._id}/approve`;
    const body = {
      depositRequestId: deposit._id.toString(),
      reason: "Đã đối chiếu giao dịch TPBank",
    };

    const approved = await withAuth(
      request(app).post(path).send(body),
      admin.accessToken,
    );
    const replay = await withAuth(
      request(app).post(path).send(body),
      admin.accessToken,
    );

    expect({
      approvedStatus: approved.status,
      replaySkipped: replay.body.skipped,
      balance: (await Wallet.findOne({ userId: customer.user._id }).lean())
        ?.balance,
      incomingStatus: (await IncomingBankTransaction.findById(incoming._id).lean())
        ?.status,
      ledgerAmounts: (
        await WalletTransaction.find({ referenceId: incoming._id }).lean()
      ).map((entry) => entry.amount),
      auditCount: await AuditLog.countDocuments({
        action: "approve_incoming_bank_transaction",
        targetId: incoming._id,
      }),
    }).toEqual({
      approvedStatus: 200,
      replaySkipped: true,
      balance: 149000,
      incomingStatus: "settled",
      ledgerAmounts: [149000],
      auditCount: 1,
    });
  });

  it("credits frozen bonus for exact reviewed transactions and reverses each ledger amount", async () => {
    const snapshot = {
      bonusRate: 20,
      bonusAmount: 40000,
      creditedAmount: 240000,
      bonusTierKey: "premium",
      policyVersion: 4,
    };
    const first = await createReviewFixture({
      depositAmount: 200000,
      incomingAmount: 200000,
      snapshot,
      reviewReason: "OUTSIDE_AUTO_SETTLEMENT_WINDOW",
      suffix: "E001",
    });
    const second = await IncomingBankTransaction.create({
      ...first.incoming.toObject(),
      _id: undefined,
      providerTransactionId: "provider-exact-second",
      sourceAliases: [
        { source: "webhook", providerTransactionId: "provider-exact-second" },
      ],
      payloadDigest: "c".repeat(64),
      fingerprintDigest: "d".repeat(64),
    });
    const admin = await createTestUser({
      email: "incoming-exact-admin@example.com",
      role: "admin",
    });
    const approve = (incoming) =>
      withAuth(
        request(app)
          .post(`/api/admin/deposits/incoming/${incoming._id}/approve`)
          .send({
            depositRequestId: first.deposit._id.toString(),
            reason: "Đã đối chiếu khoản tiền đúng ngoài thời gian",
          }),
        admin.accessToken,
      );

    const approvedFirst = await approve(first.incoming);
    const replayFirst = await approve(first.incoming);
    await approve(second);

    expect(approvedFirst.body.data).toMatchObject({
      transferredAmount: 200000,
      creditedAmount: 240000,
    });
    expect(replayFirst.body.skipped).toBe(true);
    expect(
      (await IncomingBankTransaction.findById(first.incoming._id).lean())
        .creditedAmount,
    ).toBe(240000);
    expect((await Wallet.findOne({ userId: first.customer.user._id })).balance)
      .toBe(480000);

    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${first.incoming._id}/reverse`)
        .send({ reason: "Hoàn tác khoản tiền thứ nhất bị ghi nhận trùng" }),
      admin.accessToken,
    );
    expect((await Wallet.findOne({ userId: first.customer.user._id })).balance)
      .toBe(240000);
    expect((await DepositRequest.findById(first.deposit._id)).status)
      .toBe("success");

    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${second._id}/reverse`)
        .send({ reason: "Hoàn tác khoản tiền thứ hai bị ghi nhận trùng" }),
      admin.accessToken,
    );
    const ledgerAmounts = (
      await WalletTransaction.find({
        referenceType: "incoming_bank_transaction",
      }).sort({ createdAt: 1 })
    ).map((entry) => entry.amount);
    expect(ledgerAmounts).toEqual([240000, 240000, -240000, -240000]);
    expect((await Wallet.findOne({ userId: first.customer.user._id })).balance)
      .toBe(0);
    expect((await DepositRequest.findById(first.deposit._id)).status)
      .toBe("reversed");
    expect((await reconcileWallets()).totalIssues).toBe(0);
  });

  it("ignores a review item without changing the wallet", async () => {
    const { customer, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-ignore-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/ignore`)
        .send({ reason: "Khoản tiền cá nhân không thuộc HTCOACHING" }),
      admin.accessToken,
    );

    expect({
      status: response.status,
      incomingStatus: (await IncomingBankTransaction.findById(incoming._id).lean())
        ?.status,
      balance: (await Wallet.findOne({ userId: customer.user._id }).lean())
        ?.balance,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({
      status: 200,
      incomingStatus: "ignored",
      balance: 0,
      ledgerCount: 0,
    });
  });

  it("reverses one settled incoming transaction with an append-only entry", async () => {
    const { customer, deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-reverse-admin@example.com",
      role: "admin",
    });
    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/approve`)
        .send({
          depositRequestId: deposit._id.toString(),
          reason: "Đã đối chiếu giao dịch TPBank",
        }),
      admin.accessToken,
    );

    const path = `/api/admin/deposits/incoming/${incoming._id}/reverse`;
    const reverse = await withAuth(
      request(app).post(path).send({ reason: "Admin đã cộng nhầm giao dịch" }),
      admin.accessToken,
    );
    const replay = await withAuth(
      request(app).post(path).send({ reason: "Admin đã cộng nhầm giao dịch" }),
      admin.accessToken,
    );
    const entries = await WalletTransaction.find({
      referenceId: incoming._id,
    }).sort({ createdAt: 1 });
    const reconciliation = await reconcileWallets();

    expect({
      status: reverse.status,
      replaySkipped: replay.body.skipped,
      balance: (await Wallet.findOne({ userId: customer.user._id }).lean())
        ?.balance,
      incomingStatus: (await IncomingBankTransaction.findById(incoming._id).lean())
        ?.status,
      depositStatus: (await DepositRequest.findById(deposit._id).lean())?.status,
      amounts: entries.map((entry) => entry.amount),
      reversalOf: entries[1]?.reversalOf?.toString(),
      originalId: entries[0]?._id.toString(),
      reconciliationIssues: reconciliation.totalIssues,
    }).toEqual({
      status: 200,
      replaySkipped: true,
      balance: 0,
      incomingStatus: "reversed",
      depositStatus: "reversed",
      amounts: [149000, -149000],
      reversalOf: entries[0]?._id.toString(),
      originalId: entries[0]?._id.toString(),
      reconciliationIssues: 0,
    });
  });

  it("keeps the deposit successful when a legacy credit remains active", async () => {
    const { customer, deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-legacy-reverse-admin@example.com",
      role: "admin",
    });
    await withAuth(
      request(app).post(`/api/admin/deposits/${deposit._id}/approve`),
      admin.accessToken,
    );
    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/approve`)
        .send({
          depositRequestId: deposit._id.toString(),
          reason: "Đã đối chiếu giao dịch TPBank",
        }),
      admin.accessToken,
    );

    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/reverse`)
        .send({ reason: "Hoàn tác riêng giao dịch ngân hàng" }),
      admin.accessToken,
    );

    expect({
      depositStatus: (await DepositRequest.findById(deposit._id).lean())?.status,
      balance: (await Wallet.findOne({ userId: customer.user._id }).lean())
        ?.balance,
    }).toEqual({ depositStatus: "success", balance: 150000 });
  });

  it("keeps a hybrid deposit successful until direct and incoming credits are both reversed", async () => {
    const { customer, deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-hybrid-reverse-admin@example.com",
      role: "admin",
    });
    const post = (path, body = {}) =>
      withAuth(request(app).post(path).send(body), admin.accessToken);

    await post(`/api/admin/deposits/${deposit._id}/approve`);
    await post(`/api/admin/deposits/incoming/${incoming._id}/approve`, {
      depositRequestId: deposit._id.toString(),
      reason: "Đã đối chiếu giao dịch TPBank",
    });
    const directReverse = await post(
      `/api/admin/deposits/${deposit._id}/reverse`,
      { reason: "Hoàn tác riêng khoản cộng trực tiếp bị trùng" },
    );
    const directReplay = await post(
      `/api/admin/deposits/${deposit._id}/reverse`,
      { reason: "Hoàn tác riêng khoản cộng trực tiếp bị trùng" },
    );

    expect(directReverse.status).toBe(200);
    expect(directReplay.body.skipped).toBe(true);
    expect((await DepositRequest.findById(deposit._id)).status).toBe("success");
    expect((await Wallet.findOne({ userId: customer.user._id })).balance)
      .toBe(149000);

    await post(`/api/admin/deposits/incoming/${incoming._id}/reverse`, {
      reason: "Hoàn tác khoản giao dịch ngân hàng còn lại",
    });
    expect((await DepositRequest.findById(deposit._id)).status).toBe("reversed");
    expect((await Wallet.findOne({ userId: customer.user._id })).balance).toBe(0);
    expect((await reconcileWallets()).totalIssues).toBe(0);
  });

  it("fails closed when a replayed direct reversal ledger is corrupt", async () => {
    const { deposit } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-direct-corrupt-admin@example.com",
      role: "admin",
    });
    const post = (path, body = {}) =>
      withAuth(request(app).post(path).send(body), admin.accessToken);
    await post(`/api/admin/deposits/${deposit._id}/approve`);
    await post(`/api/admin/deposits/${deposit._id}/reverse`, {
      reason: "Hoàn tác khoản cộng trực tiếp để kiểm tra",
    });
    await WalletTransaction.collection.updateOne(
      { idempotencyKey: `deposit-reversal:${deposit._id}` },
      { $set: { amount: -1 } },
    );

    const response = await post(`/api/admin/deposits/${deposit._id}/reverse`, {
      reason: "Không được chấp nhận ledger hoàn tác đã hỏng",
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DEPOSIT_REVERSAL_LEDGER_MISMATCH");
  });

  it("refuses to reverse when the incoming ledger link is inconsistent", async () => {
    const { customer, deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-corrupt-ledger-admin@example.com",
      role: "admin",
    });
    await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/approve`)
        .send({
          depositRequestId: deposit._id.toString(),
          reason: "Đã đối chiếu giao dịch TPBank",
        }),
      admin.accessToken,
    );
    const settled = await IncomingBankTransaction.findById(incoming._id).lean();
    await WalletTransaction.collection.updateOne(
      { _id: settled.walletTransactionId },
      { $set: { amount: 1 } },
    );

    const response = await withAuth(
      request(app)
        .post(`/api/admin/deposits/incoming/${incoming._id}/reverse`)
        .send({ reason: "Không được hoàn tác ledger sai liên kết" }),
      admin.accessToken,
    );

    expect({
      status: response.status,
      code: response.body.code,
      incomingStatus: (await IncomingBankTransaction.findById(incoming._id).lean())
        ?.status,
      balance: (await Wallet.findOne({ userId: customer.user._id }).lean())
        ?.balance,
    }).toEqual({
      status: 409,
      code: "INCOMING_LEDGER_MISMATCH",
      incomingStatus: "settled",
      balance: 149000,
    });
  });

  it("fails closed when a replayed incoming reversal ledger is corrupt", async () => {
    const { deposit, incoming } = await createReviewFixture();
    const admin = await createTestUser({
      email: "incoming-corrupt-reversal-admin@example.com",
      role: "admin",
    });
    const approvePath = `/api/admin/deposits/incoming/${incoming._id}/approve`;
    const reversePath = `/api/admin/deposits/incoming/${incoming._id}/reverse`;
    await withAuth(
      request(app).post(approvePath).send({
        depositRequestId: deposit._id.toString(),
        reason: "Đã đối chiếu giao dịch TPBank",
      }),
      admin.accessToken,
    );
    await withAuth(
      request(app).post(reversePath).send({
        reason: "Hoàn tác giao dịch để kiểm tra replay",
      }),
      admin.accessToken,
    );
    await WalletTransaction.collection.updateOne(
      { idempotencyKey: `bank-reversal:sepay:${incoming._id}` },
      { $set: { amount: -1 } },
    );

    const response = await withAuth(
      request(app).post(reversePath).send({
        reason: "Không chấp nhận ledger hoàn tác đã hỏng",
      }),
      admin.accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INCOMING_REVERSAL_LEDGER_MISMATCH");
  });
});
