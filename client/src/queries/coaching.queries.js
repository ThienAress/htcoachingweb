import { queryOptions } from "@tanstack/react-query";

import {
  checkMealPlanAccess,
} from "../services/mealplanAccess.service";
import { getAllFoods } from "../services/food.service";
import { enrichFoodDatabase } from "../utils/foodCategory";
import { coachingKeys } from "./queryKeys";

export const foodDatabaseQueryOptions = () =>
  queryOptions({
    queryKey: coachingKeys.foodDatabase(),
    queryFn: ({ signal }) =>
      getAllFoods(signal).then((response) => {
        const foods = response.data?.data;
        return response.data?.success && Array.isArray(foods)
          ? enrichFoodDatabase(foods)
          : [];
      }),
    staleTime: 5 * 60_000,
  });

export const mealPlanAccessQueryOptions = (userId) =>
  queryOptions({
    queryKey: coachingKeys.mealPlanAccess(userId),
    queryFn: () =>
      checkMealPlanAccess().then((response) => response.data.data),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });