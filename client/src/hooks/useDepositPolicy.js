import { useQuery } from "@tanstack/react-query";

import { normalizeDepositPolicyResponse } from "../utils/depositPolicy";
import { getDepositPolicy } from "../services/wallet.service";

export const useDepositPolicy = () =>
  useQuery({
    queryKey: ["deposit-policy"],
    queryFn: () =>
      getDepositPolicy().then(normalizeDepositPolicyResponse),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
