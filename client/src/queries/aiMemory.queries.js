import { queryOptions } from "@tanstack/react-query";

import { getAiMemory } from "../services/ai.service";
import { aiMemoryKeys } from "./queryKeys";

export const aiMemoryQueryOptions = (userId) =>
  queryOptions({
    queryKey: aiMemoryKeys.mine(userId),
    queryFn: () => getAiMemory().then((response) => response.data),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
