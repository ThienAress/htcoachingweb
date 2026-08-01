import { useQuery } from "@tanstack/react-query";

import { depositPolicyQueryOptions } from "../queries/walletAccount.queries";

export const useDepositPolicy = () =>
  useQuery(depositPolicyQueryOptions());
