import { queryOptions } from "@tanstack/react-query";

import { getMyContracts } from "../services/contract.service";
import {
  getMyOrders,
  getMyTransactions,
} from "../services/user.service";
import {
  getDepositPolicy,
  getMyDeposits,
  getMyWallet,
} from "../services/wallet.service";
import { normalizeDepositPolicyResponse } from "../utils/depositPolicy";
import { invalidateByKey } from "./invalidation";
import { subscriptionKeys, walletAccountKeys } from "./queryKeys";
import { retryServerQueryOnce } from "./queryRetry";

const OPEN_DEPOSIT_STATUSES = new Set(["pending", "needs_review"]);

export const hasOpenDeposit = (deposits = []) =>
  deposits.some((deposit) => OPEN_DEPOSIT_STATUSES.has(deposit.status));

export const getDepositSettlementSignal = (deposits = []) =>
  deposits
    .map(
      (deposit) =>
        `${deposit._id}:${deposit.status}:${deposit.settledTransactionCount || 0}`,
    )
    .join("|");

const privateQueryDefaults = ({ userId, enabled }) => ({
  enabled: Boolean(userId && enabled),
  retry: retryServerQueryOnce,
  refetchOnWindowFocus: true,
});

export const depositPolicyQueryOptions = () =>
  queryOptions({
    queryKey: walletAccountKeys.wallet.policy(),
    queryFn: ({ signal }) =>
      getDepositPolicy({ signal }).then(normalizeDepositPolicyResponse),
    staleTime: 5 * 60_000,
    retry: retryServerQueryOnce,
  });

export const walletBalanceQueryOptions = ({
  userId,
  enabled = true,
}) =>
  queryOptions({
    queryKey: walletAccountKeys.wallet.mine(userId),
    queryFn: ({ signal }) =>
      getMyWallet({ signal }).then((response) => response.data.data),
    staleTime: 30_000,
    ...privateQueryDefaults({ userId, enabled }),
  });

export const walletDepositsQueryOptions = ({
  userId,
  enabled = true,
}) =>
  queryOptions({
    queryKey: walletAccountKeys.wallet.deposits(userId),
    queryFn: ({ signal }) =>
      getMyDeposits({ signal }).then((response) => response.data.data || []),
    staleTime: (query) =>
      hasOpenDeposit(query.state.data) ? 15_000 : 60_000,
    refetchInterval: (query) =>
      hasOpenDeposit(query.state.data) ? 15_000 : false,
    ...privateQueryDefaults({ userId, enabled }),
  });

export const accountOrdersQueryOptions = ({
  userId,
  enabled = true,
}) =>
  queryOptions({
    queryKey: walletAccountKeys.account.orders(userId),
    queryFn: ({ signal }) =>
      getMyOrders({ signal }).then((data) => ({
        trainerSubscriptions: data.trainerSubscriptions || [],
        fitnessSubscriptions: data.fitnessSubscriptions || [],
        trainerOrders: data.trainerOrders || [],
        clientOrders: data.clientOrders || [],
      })),
    staleTime: 60_000,
    ...privateQueryDefaults({ userId, enabled }),
  });

export const accountTransactionsQueryOptions = ({
  userId,
  enabled = true,
}) =>
  queryOptions({
    queryKey: walletAccountKeys.account.transactions(userId),
    queryFn: ({ signal }) =>
      getMyTransactions({ signal }).then((data) => data.transactions || []),
    staleTime: 30_000,
    ...privateQueryDefaults({ userId, enabled }),
  });

export const accountContractsQueryOptions = ({
  userId,
  enabled = true,
}) =>
  queryOptions({
    queryKey: walletAccountKeys.account.contracts(userId),
    queryFn: ({ signal }) =>
      getMyContracts({ signal }).then((response) => response.data?.data || []),
    staleTime: 60_000,
    ...privateQueryDefaults({ userId, enabled }),
  });

export const invalidateDepositHistory = (queryClient, userId) =>
  invalidateByKey(queryClient, walletAccountKeys.wallet.deposits(userId));

export const applyTrainerPlanPurchaseResponse = async ({
  queryClient,
  userId,
  response,
}) => {
  const newBalance = response?.data?.data?.newBalance;
  if (Number.isSafeInteger(newBalance) && newBalance >= 0) {
    queryClient.setQueryData(
      walletAccountKeys.wallet.mine(userId),
      (current) => current && { ...current, balance: newBalance },
    );
  }

  await Promise.all([
    invalidateByKey(queryClient, walletAccountKeys.wallet.mine(userId)),
    invalidateByKey(
      queryClient,
      walletAccountKeys.account.transactions(userId),
    ),
    invalidateByKey(queryClient, walletAccountKeys.account.orders(userId)),
    invalidateByKey(queryClient, subscriptionKeys.mine(userId)),
  ]);
};
