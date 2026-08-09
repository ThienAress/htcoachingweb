import { queryOptions } from "@tanstack/react-query";

import { getServiceAccessPolicies } from "../services/serviceAccessPolicy.service";
import { adminQueryKeys } from "./queryKeys";

export const serviceAccessPoliciesQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.serviceAccessPolicies.all(),
    queryFn: ({ signal }) =>
      getServiceAccessPolicies(signal).then((response) => response.data.data),
    staleTime: 5 * 60 * 1000,
  });
