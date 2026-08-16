import { queryOptions } from "@tanstack/react-query";

import {
  createSkillRadarSource,
  getSkillRadar,
  previewSkillRadarSource,
} from "../services/skillRadar.service";
import { adminQueryKeys } from "./queryKeys";

export const skillRadarQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.skillRadar.all(),
    queryFn: ({ signal }) =>
      getSkillRadar(signal).then((response) => response.data.data),
    staleTime: 5 * 60 * 1000,
  });

const responseData = (response) => response.data.data;

export const skillRadarPreviewMutationOptions = () => ({
  mutationFn: (repoUrl) => previewSkillRadarSource(repoUrl).then(responseData),
});

export const skillRadarCreateMutationOptions = () => ({
  mutationFn: (source) => createSkillRadarSource(source).then(responseData),
});

export const addSkillRadarItemToCache = (current, result) => {
  const item = result?.item || result?.source || result;
  if (!current || !item?.id) return current;

  const items = [item, ...(current.items || []).filter((entry) => entry.id !== item.id)];
  const summary = {
    ...current.summary,
    total: items.length,
    active: items.filter((entry) => entry.lifecycle === "active").length,
    changed: items.filter((entry) => entry.drift === "changed").length,
    reviewDue: items.filter((entry) => entry.drift === "review_due").length,
    candidates: items.filter((entry) => entry.lifecycle === "candidate").length,
    dormant: items.filter((entry) => entry.lifecycle === "dormant").length,
    rateLimited: items.filter((entry) => entry.drift === "rate_limited").length,
    unreachable: items.filter((entry) => entry.drift === "unreachable").length,
  };

  return { ...current, items, summary };
};
