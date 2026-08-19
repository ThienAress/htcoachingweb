import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendContractMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Contract from "../../models/Contract.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import contractRoutes from "../contract.routes.js";
import userRoutes from "../user.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/user", userRoutes);
  app.use("/api/contracts", contractRoutes);
  await Promise.all([
    Contract.init(),
    FitnessSubscription.init(),
    Order.init(),
    TrainerSubscription.init(),
    Wallet.init(),
    WalletTransaction.init(),
  ]);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Account read models", () => {
  test("returns only the authenticated actor''s orders and transactions", async () => {
    const { user: actor, accessToken } = await createTestUser({
      email: "account-actor@example.com",
    });
    const { user: other } = await createTestUser({
      email: "account-other@example.com",
    });
    const [actorOrder, otherOrder] = await Order.create([
      {
        userId: actor._id,
        trainerId: other._id,
        package: "Actor package",
        sessions: 8,
        totalSessions: 8,
      },
      {
        userId: other._id,
        trainerId: other._id,
        package: "Other package",
        sessions: 8,
        totalSessions: 8,
      },
    ]);
    await TrainerSubscription.create({
      userId: actor._id,
      planTitle: "Actor plan",
      billingCycle: "month",
      amount: 100_000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    });
    await FitnessSubscription.create([
      {
        userId: actor._id,
        planCode: "fitness_plus_smart",
        planTitle: "Tăng tốc",
        billingCycle: "month",
        amount: 199_000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        purchaseRequestId: "22222222-2222-4222-8222-222222222222",
      },
      {
        userId: other._id,
        planCode: "fitness_plus_essential",
        planTitle: "Nền tảng",
        billingCycle: "month",
        amount: 99_000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        purchaseRequestId: "33333333-3333-4333-8333-333333333333",
      },
    ]);
    const [actorWallet, otherWallet] = await Wallet.create([
      { userId: actor._id, balance: 100_000 },
      { userId: other._id, balance: 100_000 },
    ]);
    const [actorTransaction, otherTransaction] =
      await WalletTransaction.create([
        {
          userId: actor._id,
          walletId: actorWallet._id,
          type: "purchase",
          amount: -10_000,
          balanceBefore: 100_000,
          balanceAfter: 90_000,
          referenceType: "order",
          referenceId: actorOrder._id,
          idempotencyKey: "account-actor-transaction",
        },
        {
          userId: other._id,
          walletId: otherWallet._id,
          type: "purchase",
          amount: -10_000,
          balanceBefore: 100_000,
          balanceAfter: 90_000,
          referenceType: "order",
          referenceId: otherOrder._id,
          idempotencyKey: "account-other-transaction",
        },
      ]);

    const [ordersResponse, transactionsResponse] = await Promise.all([
      withAuth(request(app).get("/api/user/me/orders"), accessToken),
      withAuth(request(app).get("/api/user/me/transactions"), accessToken),
    ]);

    expect({
      orderStatus: ordersResponse.status,
      orderEnvelope: ordersResponse.body.success,
      trainerOrderIds: ordersResponse.body.trainerOrders.map(
        (order) => order._id,
      ),
      clientOrders: ordersResponse.body.clientOrders,
      subscriptionUserIds: ordersResponse.body.trainerSubscriptions.map(
        (subscription) => subscription.userId,
      ),
      fitnessPlanCodes: ordersResponse.body.fitnessSubscriptions.map(
        (subscription) => subscription.planCode,
      ),
      fitnessPurchaseRequestIds: ordersResponse.body.fitnessSubscriptions.map(
        (subscription) => subscription.purchaseRequestId,
      ),
      transactionStatus: transactionsResponse.status,
      transactionEnvelope: transactionsResponse.body.success,
      transactionIds: transactionsResponse.body.transactions.map(
        (transaction) => transaction._id,
      ),
    }).toEqual({
      orderStatus: 200,
      orderEnvelope: true,
      trainerOrderIds: [actorOrder._id.toString()],
      clientOrders: [],
      subscriptionUserIds: [actor._id.toString()],
      fitnessPlanCodes: ["fitness_plus_smart"],
      fitnessPurchaseRequestIds: [undefined],
      transactionStatus: 200,
      transactionEnvelope: true,
      transactionIds: [actorTransaction._id.toString()],
    });
  });

  test("returns contracts only where the actor is the client", async () => {
    const { user: actor, accessToken } = await createTestUser({
      email: "contract-actor@example.com",
    });
    const { user: other } = await createTestUser({
      email: "contract-other@example.com",
    });
    const [actorOrder, otherOrder] = await Order.create([
      {
        userId: actor._id,
        trainerId: other._id,
        package: "Actor contract package",
        sessions: 8,
        totalSessions: 8,
      },
      {
        userId: other._id,
        trainerId: actor._id,
        package: "Other contract package",
        sessions: 8,
        totalSessions: 8,
      },
    ]);
    const [actorContract] = await Contract.create([
      {
        orderId: actorOrder._id,
        clientId: actor._id,
        trainerId: other._id,
        clientInfo: { name: actor.name },
      },
      {
        orderId: otherOrder._id,
        clientId: other._id,
        trainerId: actor._id,
        clientInfo: { name: other.name },
      },
    ]);

    const response = await withAuth(
      request(app).get("/api/contracts/my"),
      accessToken,
    );

    expect({
      status: response.status,
      success: response.body.success,
      contractIds: response.body.data.map((contract) => contract._id),
    }).toEqual({
      status: 200,
      success: true,
      contractIds: [actorContract._id.toString()],
    });
  });

  test("rejects unauthenticated account reads", async () => {
    const responses = await Promise.all([
      request(app).get("/api/user/me/orders"),
      request(app).get("/api/user/me/transactions"),
      request(app).get("/api/contracts/my"),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401,
      401,
      401,
    ]);
  });
});
