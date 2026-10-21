import { queryOptions } from "@tanstack/react-query";

import { getMySubscription, getTrainerPurchaseQuote } from "../services/trainerSubscription.service";
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

// Báo giá nâng cấp (đã trừ phần gói tháng chưa dùng): luôn lấy mới khi mở thanh toán để số tiền khớp với server.
export const trainerPurchaseQuoteQueryOptions = ({ userId, planCode, billingCycle, enabled = true }) =>
  queryOptions({
    queryKey: subscriptionKeys.quote(userId, planCode, billingCycle),
    queryFn: ({ signal }) =>
      getTrainerPurchaseQuote({ planCode, billingCycle, signal }).then((response) => response.data.data),
    enabled: Boolean(userId && planCode && billingCycle && enabled),
    staleTime: 0,
    gcTime: 0,
    retry: retryServerQueryOnce,
  });
