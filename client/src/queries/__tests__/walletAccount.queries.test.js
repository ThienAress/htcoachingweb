import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../services/contract.service", () => ({
  getMyContracts: vi.fn(),
}));
vi.mock("../../services/user.service", () => ({
  getMyOrders: vi.fn(),
  getMyTransactions: vi.fn(),
}));
vi.mock("../../services/wallet.service", () => ({
  getDepositPolicy: vi.fn(),
  getMyDeposits: vi.fn(),
  getMyWallet: vi.fn(),
}));

import { getMyContracts } from "../../services/contract.service";
import {
  getMyOrders,
  getMyTransactions,
} from "../../services/user.service";
import { getMyWallet } from "../../services/wallet.service";
import {
  accountContractsQueryOptions,
  accountOrdersQueryOptions,
  accountTransactionsQueryOptions,
  applyTrainerPlanPurchaseResponse,
  getDepositSettlementSignal,
  walletBalanceQueryOptions,
  walletDepositsQueryOptions,
} from "../walletAccount.queries";
import { subscriptionKeys, walletAccountKeys } from "../queryKeys";

describe("Wallet and account query infrastructure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("isolates every private query identity by user", () => {
    const userOneKeys = [
      walletAccountKeys.wallet.mine("user-1"),
      walletAccountKeys.wallet.deposits("user-1"),
      walletAccountKeys.account.orders("user-1"),
      walletAccountKeys.account.transactions("user-1"),
      walletAccountKeys.account.contracts("user-1"),
    ];
    const userTwoKeys = [
      walletAccountKeys.wallet.mine("user-2"),
      walletAccountKeys.wallet.deposits("user-2"),
      walletAccountKeys.account.orders("user-2"),
      walletAccountKeys.account.transactions("user-2"),
      walletAccountKeys.account.contracts("user-2"),
    ];

    expect(
      userOneKeys.map(
        (queryKey, index) =>
          JSON.stringify(queryKey) !== JSON.stringify(userTwoKeys[index]),
      ),
    ).toEqual([true, true, true, true, true]);
  });

  test("normalizes wallet data and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    getMyWallet.mockResolvedValue({
      data: { data: { balance: 125_000, currency: "VND" } },
    });

    const result = await walletBalanceQueryOptions({
      userId: "user-1",
    }).queryFn({ signal });

    expect({ result, call: getMyWallet.mock.calls[0][0] }).toEqual({
      result: { balance: 125_000, currency: "VND" },
      call: { signal },
    });
  });

  test("polls deposits only while an open deposit exists", () => {
    const options = walletDepositsQueryOptions({ userId: "user-1" });

    expect([
      options.refetchInterval({
        state: { data: [{ status: "needs_review" }] },
      }),
      options.refetchInterval({ state: { data: [{ status: "success" }] } }),
    ]).toEqual([15_000, false]);
  });

  test("changes the settlement signal when server-authoritative deposit state changes", () => {
    expect([
      getDepositSettlementSignal([
        { _id: "deposit-1", status: "pending", settledTransactionCount: 0 },
      ]),
      getDepositSettlementSignal([
        { _id: "deposit-1", status: "success", settledTransactionCount: 1 },
      ]),
    ]).toEqual(["deposit-1:pending:0", "deposit-1:success:1"]);
  });

  test("does not retry client errors and retries a server error once", () => {
    const retry = walletBalanceQueryOptions({ userId: "user-1" }).retry;

    expect([
      retry(0, { response: { status: 403 } }),
      retry(0, { response: { status: 503 } }),
      retry(1, { response: { status: 503 } }),
    ]).toEqual([false, true, false]);
  });

  test("normalizes account domains independently", async () => {
    getMyOrders.mockResolvedValue({ trainerOrders: [{ _id: "order-1" }] });
    getMyTransactions.mockResolvedValue({ transactions: [{ _id: "tx-1" }] });
    getMyContracts.mockResolvedValue({ data: { data: [{ _id: "contract-1" }] } });

    const [orders, transactions, contracts] = await Promise.all([
      accountOrdersQueryOptions({ userId: "user-1" }).queryFn({}),
      accountTransactionsQueryOptions({ userId: "user-1" }).queryFn({}),
      accountContractsQueryOptions({ userId: "user-1" }).queryFn({}),
    ]);

    expect({ orders, transactions, contracts }).toEqual({
      orders: {
        trainerSubscriptions: [],
        trainerOrders: [{ _id: "order-1" }],
        clientOrders: [],
      },
      transactions: [{ _id: "tx-1" }],
      contracts: [{ _id: "contract-1" }],
    });
  });

  test("uses only the server balance and invalidates purchase consumers", async () => {
    const queryClient = new QueryClient();
    const walletKey = walletAccountKeys.wallet.mine("user-1");
    const transactionsKey = walletAccountKeys.account.transactions("user-1");
    const ordersKey = walletAccountKeys.account.orders("user-1");
    const subscriptionKey = subscriptionKeys.mine("user-1");
    const unrelatedKey = walletAccountKeys.account.contracts("user-1");
    queryClient.setQueryData(walletKey, { balance: 200_000, currency: "VND" });
    queryClient.setQueryData(transactionsKey, []);
    queryClient.setQueryData(ordersKey, {});
    queryClient.setQueryData(subscriptionKey, null);
    queryClient.setQueryData(unrelatedKey, []);

    await applyTrainerPlanPurchaseResponse({
      queryClient,
      userId: "user-1",
      response: { data: { skipped: true, data: { newBalance: 150_000 } } },
    });

    expect({
      wallet: queryClient.getQueryData(walletKey),
      invalidated: queryClient.getQueryCache().getAll().map((query) => [
        query.queryKey,
        query.state.isInvalidated,
      ]),
    }).toEqual({
      wallet: { balance: 150_000, currency: "VND" },
      invalidated: [
        [walletKey, true],
        [transactionsKey, true],
        [ordersKey, true],
        [subscriptionKey, true],
        [unrelatedKey, false],
      ],
    });
  });
});
