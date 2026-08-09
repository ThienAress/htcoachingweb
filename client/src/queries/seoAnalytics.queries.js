import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import {
  getAnalyticsBlogDetail,
  getAnalyticsBlogs,
  getAnalyticsKeywords,
  getAnalyticsOverview,
  getAnalyticsProviders,
} from "../services/seoAnalytics.service";
import { adminQueryKeys } from "./queryKeys";

const responseData = (response) => response.data.data;

export const analyticsOverviewQueryOptions = (filters) =>
  queryOptions({
    queryKey: adminQueryKeys.seoAnalytics.overview(filters),
    queryFn: ({ signal }) =>
      getAnalyticsOverview(filters, signal).then(responseData),
    staleTime: 5 * 60 * 1000,
  });

export const analyticsProvidersQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.seoAnalytics.providers(),
    queryFn: ({ signal }) => getAnalyticsProviders(signal).then(responseData),
    staleTime: 60 * 1000,
  });

export const analyticsBlogQueryOptions = (filters) =>
  queryOptions({
    queryKey: adminQueryKeys.seoAnalytics.blogs.list(filters),
    queryFn: ({ signal }) => getAnalyticsBlogs(filters, signal).then(responseData),
    placeholderData: keepPreviousData,
  });

export const analyticsKeywordQueryOptions = (filters) =>
  queryOptions({
    queryKey: adminQueryKeys.seoAnalytics.keywords.list(filters),
    queryFn: ({ signal }) =>
      getAnalyticsKeywords(filters, signal).then(responseData),
    placeholderData: keepPreviousData,
  });

export const analyticsBlogDetailQueryOptions = ({ slug, ...filters }) =>
  queryOptions({
    queryKey: adminQueryKeys.seoAnalytics.blogs.detail(slug, filters),
    queryFn: ({ signal }) =>
      getAnalyticsBlogDetail(slug, filters, signal).then(responseData),
    enabled: Boolean(slug),
  });
