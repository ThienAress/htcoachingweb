import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { coachingKeys } from "../queries/queryKeys";
import {
  deleteMyMealPlanPreferences,
  getMyMealPlanPreferences,
  updateMyMealPlanPreferences,
} from "../services/user.service";

export const useMealPlanPreferences = (userId) => {
  const queryClient = useQueryClient();
  const queryKey = coachingKeys.mealPlanPreferences(userId);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getMyMealPlanPreferences({ signal }),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: updateMyMealPlanPreferences,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteMyMealPlanPreferences,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    retry: query.refetch,
    save: mutation.mutateAsync,
    clear: deleteMutation.mutateAsync,
    isSaving: mutation.isPending,
    isClearing: deleteMutation.isPending,
    isMutating: mutation.isPending || deleteMutation.isPending,
    saveError: mutation.error,
    clearError: deleteMutation.error,
  };
};
