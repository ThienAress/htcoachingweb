import { queryOptions } from "@tanstack/react-query";

import {
  getFitnessPlusCatalog,
  getMyFitnessPlusSubscription,
} from "../services/fitnessPlus.service";
import { normalizeFitnessPlusCatalogResponse } from "../utils/fitnessPlusCatalog";
import { fitnessPlusKeys, walletAccountKeys } from "./queryKeys";
import { invalidateByKey } from "./invalidation";
import { retryServerQueryOnce } from "./queryRetry";

export const fitnessPlusCatalogQueryOptions = () =>
  queryOptions({
    queryKey: fitnessPlusKeys.catalog(),
    queryFn: ({ signal }) =>
      getFitnessPlusCatalog({ signal }).then(normalizeFitnessPlusCatalogResponse),
    staleTime: 5 * 60_000,
    retry: retryServerQueryOnce,
  });

export const myFitnessPlusSubscriptionQueryOptions = ({
  userId,
  enabled = true,
} = {}) =>
  queryOptions({
    queryKey: fitnessPlusKeys.mine(userId),
    queryFn: ({ signal }) =>
      getMyFitnessPlusSubscription({ signal }).then(
        (response) => response.data.data,
      ),
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: retryServerQueryOnce,
  });

export const applyFitnessPlusPurchaseResponse = async ({
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
    invalidateByKey(queryClient, walletAccountKeys.account.transactions(userId)),
    invalidateByKey(queryClient, walletAccountKeys.account.orders(userId)),
    invalidateByKey(queryClient, fitnessPlusKeys.mine(userId)),
  ]);
};
