import { queryOptions } from "@tanstack/react-query";

import { getAiCredits } from "../services/ai.service";

export const aiCreditsQueryKey = (actorKey) => ["ai-credits", actorKey || "guest"];

export const aiCreditsQueryOptions = (actorKey, enabled = true) =>
  queryOptions({
    queryKey: aiCreditsQueryKey(actorKey),
    queryFn: ({ signal }) => getAiCredits(signal).then((response) => response.data),
    enabled,
    staleTime: 30 * 1000,
    retry: 1,
  });
