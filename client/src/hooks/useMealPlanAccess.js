import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "../context/AuthContext";
import { mealPlanAccessQueryOptions } from "../queries/coaching.queries";
import { coachingKeys } from "../queries/queryKeys";
import { recordMealPlanGeneration } from "../services/mealplanAccess.service";
import { deriveMealPlanAccess } from "../utils/mealPlanAccess";

export const useMealPlanAccess = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = coachingKeys.mealPlanAccess(user?._id);
  const accessQuery = useQuery(mealPlanAccessQueryOptions(user?._id));
  const accessLevel = accessQuery.data?.access || null;
  const generationCount = accessQuery.data?.generationCount || 0;
  const maxGenerations = accessQuery.data?.maxGenerations ?? null;

  const recordMutation = useMutation({
    mutationFn: recordMealPlanGeneration,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, (current) => ({
        ...(current || {}),
        generationCount: response.data.data.generationCount,
      }));
    },
    onError: (error) => {
      if (error.response?.status !== 403) return;
      const data = error.response.data?.data;
      if (!data) return;
      queryClient.setQueryData(queryKey, (current) => ({
        ...(current || {}),
        ...data,
      }));
    },
  });

  const recordGenerationMutation = recordMutation.mutateAsync;
  const refetchAccess = accessQuery.refetch;

  const { canGenerate, remainingGenerations } = deriveMealPlanAccess({
    accessLevel,
    generationCount,
    maxGenerations,
  });

  const recordGeneration = useCallback(async () => {
    if (accessLevel === "unlimited") return true;
    if (accessLevel !== "trial") return false;

    try {
      await recordGenerationMutation();
      return true;
    } catch {
      return false;
    }
  }, [accessLevel, recordGenerationMutation]);

  const retryAccess = useCallback(() => refetchAccess(), [refetchAccess]);

  return {
    accessLevel,
    isChecking: Boolean(user && accessQuery.isPending),
    accessError: Boolean(user && accessQuery.isError),
    retryAccess,
    canGenerate,
    remainingGenerations,
    generationCount,
    recordGeneration,
    maxGenerations,
  };
};
