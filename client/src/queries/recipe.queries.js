import { queryOptions } from "@tanstack/react-query";

import {
  getBookmarkedRecipes,
  getRecipeBySlug,
  getRecipeReviews,
} from "../services/recipe.service";
import { invalidateByKey } from "./invalidation";
import { publicRecipeKeys } from "./queryKeys";

export const recipeDetailQueryOptions = ({ slug, language }) =>
  queryOptions({
    queryKey: publicRecipeKeys.detail(slug, language),
    queryFn: ({ signal }) => getRecipeBySlug(slug, signal),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });

export const recipeBookmarksQueryOptions = (userId) =>
  queryOptions({
    queryKey: publicRecipeKeys.bookmarks(userId),
    queryFn: ({ signal }) => getBookmarkedRecipes(signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

export const recipeReviewsQueryOptions = (recipeId) =>
  queryOptions({
    queryKey: publicRecipeKeys.reviews(recipeId),
    queryFn: ({ signal }) => getRecipeReviews(recipeId, signal),
    enabled: Boolean(recipeId),
    staleTime: 60_000,
  });

export const updateRecipeBookmarks = (current, recipe, saved) => {
  if (!recipe?._id) return current;

  const currentItems = current?.data || [];
  return {
    ...(current || { success: true }),
    data: saved
      ? [
          ...currentItems.filter((item) => item._id !== recipe._id),
          recipe,
        ]
      : currentItems.filter((item) => item._id !== recipe._id),
  };
};
export const recipeBookmarkCacheCallbacks = ({
  queryClient,
  queryKey,
  recipe,
  wasSaved,
}) => ({
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (current) =>
      updateRecipeBookmarks(current, recipe, !wasSaved),
    );
    return { previous };
  },
  onError: (_error, _variables, context) => {
    queryClient.setQueryData(queryKey, context?.previous);
  },
  onSuccess: (result) => {
    queryClient.setQueryData(queryKey, (current) =>
      updateRecipeBookmarks(current, recipe, result.saved),
    );
  },
  onSettled: () => invalidateByKey(queryClient, queryKey),
});
