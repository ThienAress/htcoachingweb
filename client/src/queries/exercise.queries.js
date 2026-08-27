import { queryOptions } from "@tanstack/react-query";

import {
  getExerciseById,
  getExerciseReviews,
} from "../services/exercise.service";
import { publicExerciseKeys } from "./queryKeys";

export const exerciseDetailQueryOptions = ({ exerciseId, language }) =>
  queryOptions({
    queryKey: publicExerciseKeys.detail(exerciseId, language),
    queryFn: ({ signal }) => getExerciseById(exerciseId, signal),
    enabled: Boolean(exerciseId),
    staleTime: 5 * 60_000,
  });

export const exerciseReviewsQueryOptions = (exerciseId) =>
  queryOptions({
    queryKey: publicExerciseKeys.reviews(exerciseId),
    queryFn: ({ signal }) => getExerciseReviews(exerciseId, signal),
    enabled: Boolean(exerciseId),
    staleTime: 60_000,
  });
