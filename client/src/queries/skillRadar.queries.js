import { queryOptions } from "@tanstack/react-query";

import { getSkillRadar } from "../services/skillRadar.service";
import { adminQueryKeys } from "./queryKeys";

export const skillRadarQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.skillRadar.all(),
    queryFn: ({ signal }) =>
      getSkillRadar(signal).then((response) => response.data.data),
    staleTime: 5 * 60 * 1000,
  });
