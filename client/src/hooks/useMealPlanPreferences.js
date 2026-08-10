import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { coachingKeys } from "../queries/queryKeys";
import {
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

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    retry: query.refetch,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
