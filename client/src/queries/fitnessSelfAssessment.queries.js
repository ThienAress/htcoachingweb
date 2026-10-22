import { queryOptions } from "@tanstack/react-query";

import {
  getMySelfAssessment,
  listMySelfAssessments,
} from "../services/fitnessSelfAssessment.service";
import { selfAssessmentKeys } from "./queryKeys";
import { retryServerQueryOnce } from "./queryRetry";

export const mySelfAssessmentQueryOptions = ({ userId, enabled = true } = {}) =>
  queryOptions({
    queryKey: selfAssessmentKeys.mine(userId),
    queryFn: ({ signal }) =>
      getMySelfAssessment({ signal }).then((response) => response.data.data),
    enabled: Boolean(userId && enabled),
    staleTime: 30_000,
    retry: retryServerQueryOnce,
  });

export const selfAssessmentHistoryQueryOptions = ({ userId, enabled = true } = {}) =>
  queryOptions({
    queryKey: selfAssessmentKeys.history(userId),
    queryFn: ({ signal }) =>
      listMySelfAssessments({ signal }).then((response) => response.data.data),
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
    retry: retryServerQueryOnce,
  });
