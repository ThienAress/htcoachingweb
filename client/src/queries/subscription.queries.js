import { queryOptions } from "@tanstack/react-query";

import { getMySubscription } from "../services/trainerSubscription.service";
import { subscriptionKeys } from "./queryKeys";
import { retryServerQueryOnce } from "./queryRetry";

const selectSubscription = (snapshot) => snapshot.subscription;

export const selectMySubscriptionSnapshot = (snapshot) => snapshot;

export const mySubscriptionQueryOptions = ({
  userId,
  enabled = true,
  retry,
  select = selectSubscription,
}) =>
  queryOptions({
    queryKey: subscriptionKeys.mine(userId),
    queryFn: ({ signal }) =>
      getMySubscription({ signal }).then((response) => ({
        subscription: response.data.data,
        freeTrial: response.data.freeTrial || null,
      })),
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: retry === undefined ? retryServerQueryOnce : retry,
    select,
  });
