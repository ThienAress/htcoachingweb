import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { invalidateByKey } from "../invalidation";
import {
  adminQueryKeys,
  publicRecipeKeys,
  subscriptionKeys,
} from "../queryKeys";
import {
  recipeBookmarkCacheCallbacks,
  updateRecipeBookmarks,
} from "../recipe.queries";
import { mySubscriptionQueryOptions } from "../subscription.queries";

describe("TanStack Query infrastructure", () => {
  test("invalidates only queries matching the requested prefix", async () => {
    const queryClient = new QueryClient();
    const targetKey = adminQueryKeys.trainers.list({ page: 1 });
    const unrelatedKey = adminQueryKeys.users.list({ page: 1 });
    queryClient.setQueryData(targetKey, ["trainer"]);
    queryClient.setQueryData(unrelatedKey, ["user"]);

    await invalidateByKey(queryClient, adminQueryKeys.trainers.all());

    expect(
      queryClient.getQueryCache().getAll().map((query) => ({
        key: query.queryKey,
        invalidated: query.state.isInvalidated,
      })),
    ).toEqual([
      { key: targetKey, invalidated: true },
      { key: unrelatedKey, invalidated: false },
    ]);
  });

  test("uses one subscription identity across shared consumers", () => {
    const options = mySubscriptionQueryOptions({
      userId: "user-1",
      enabled: true,
    });

    expect(options.queryKey).toEqual(subscriptionKeys.mine("user-1"));
  });

  test("keeps admin list filters in the query identity", () => {
    expect(
      adminQueryKeys.bookings.list({
        page: 2,
        limit: 9,
        status: "pending",
        search: "an",
      }),
    ).not.toEqual(
      adminQueryKeys.bookings.list({
        page: 1,
        limit: 9,
        status: "pending",
        search: "an",
      }),
    );
  });

  test("keeps language in the recipe detail identity", () => {
    expect(publicRecipeKeys.detail("pho-bo", "vi")).not.toEqual(
      publicRecipeKeys.detail("pho-bo", "en"),
    );
  });

  test("adds a recipe to the optimistic bookmark cache", () => {
    const recipe = { _id: "recipe-1", slug: "pho-bo" };

    expect(updateRecipeBookmarks({ data: [] }, recipe, true)).toEqual({
      data: [recipe],
    });
  });

  test("removes a recipe from the optimistic bookmark cache", () => {
    const recipe = { _id: "recipe-1", slug: "pho-bo" };

    expect(
      updateRecipeBookmarks({ data: [recipe] }, recipe, false),
    ).toEqual({ data: [] });
  });
  test("restores the bookmark snapshot when the optimistic command fails", async () => {
    const queryClient = new QueryClient();
    const queryKey = publicRecipeKeys.bookmarks("user-1");
    const recipe = { _id: "recipe-1", slug: "pho-bo" };
    const previous = { data: [recipe] };
    queryClient.setQueryData(queryKey, previous);
    const callbacks = recipeBookmarkCacheCallbacks({
      queryClient,
      queryKey,
      recipe,
      wasSaved: true,
    });

    const context = await callbacks.onMutate();
    callbacks.onError(new Error("failed"), undefined, context);

    expect(queryClient.getQueryData(queryKey)).toEqual(previous);
  });
});
