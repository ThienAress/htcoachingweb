import { useQuery } from "@tanstack/react-query";

import { getTrainerPlanCatalog } from "../services/trainerSubscription.service";
import { normalizeTrainerPlanCatalogResponse } from "../utils/trainerPlanCatalog";

export const TRAINER_PLAN_CATALOG_QUERY_KEY = ["trainer-plan-catalog"];

export const useTrainerPlanCatalog = () =>
  useQuery({
    queryKey: TRAINER_PLAN_CATALOG_QUERY_KEY,
    queryFn: getTrainerPlanCatalog,
    select: normalizeTrainerPlanCatalogResponse,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
