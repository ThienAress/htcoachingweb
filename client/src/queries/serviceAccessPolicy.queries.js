import { queryOptions } from "@tanstack/react-query";

import {
  getCommunityFeatureReport,
  getServiceAccessPolicies,
} from "../services/serviceAccessPolicy.service";
import { adminQueryKeys } from "./queryKeys";

export const serviceAccessPoliciesQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.serviceAccessPolicies.all(),
    queryFn: ({ signal }) =>
      getServiceAccessPolicies(signal).then((response) => response.data.data),
    staleTime: 5 * 60 * 1000,
  });

export const communityFeatureReportQueryOptions = (filters, enabled = true) =>
  queryOptions({
    queryKey:
      adminQueryKeys.serviceAccessPolicies.communityFeatureReport(filters),
    queryFn: ({ signal }) =>
      getCommunityFeatureReport(filters, signal).then(
        (response) => response.data.data,
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
