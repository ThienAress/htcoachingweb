import { useQuery } from "@tanstack/react-query";

import { foodDatabaseQueryOptions } from "../queries/coaching.queries";

export const useFoodDatabase = () => {
  const query = useQuery(foodDatabaseQueryOptions());

  return {
    foodDatabase: query.data || [],
    isLoadingFoods: query.isLoading,
  };
};
