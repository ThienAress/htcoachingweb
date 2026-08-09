import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from "../../utils/api";
import {
  analyticsBlogQueryOptions,
  analyticsOverviewQueryOptions,
} from "../seoAnalytics.queries";
import { adminQueryKeys } from "../queryKeys";
import {
  getAnalyticsOverview,
  syncAnalyticsProvider,
} from "../../services/seoAnalytics.service";

describe("SEO analytics frontend contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps date and list filters in query identity", () => {
    const first = adminQueryKeys.seoAnalytics.blogs.list({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      page: 1,
    });
    const second = adminQueryKeys.seoAnalytics.blogs.list({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      page: 2,
    });

    expect(first).not.toEqual(second);
  });

  it("passes AbortSignal and bounded params through service layer", async () => {
    const signal = new AbortController().signal;
    api.get.mockResolvedValueOnce({ data: { success: true, data: { kpis: {} } } });

    await getAnalyticsOverview(
      { startDate: "2026-08-01", endDate: "2026-08-05" },
      signal,
    );

    expect(api.get).toHaveBeenCalledWith("/admin/analytics/overview", {
      params: { startDate: "2026-08-01", endDate: "2026-08-05" },
      signal,
    });
  });

  it("maps overview response into TanStack Query data", async () => {
    const payload = { kpis: { clicks: 12 } };
    api.get.mockResolvedValueOnce({ data: { success: true, data: payload } });
    const options = analyticsOverviewQueryOptions({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
    });

    const data = await options.queryFn({ signal: new AbortController().signal });

    expect(data).toEqual(payload);
  });

  it("uses keep-previous-data for server-paginated Blog rows", () => {
    const options = analyticsBlogQueryOptions({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      page: 2,
      limit: 20,
      sort: "clicks",
      direction: "desc",
      search: "macro",
    });

    expect(options.placeholderData).toBeTypeOf("function");
  });

  it("sends manual sync body through CSRF-enabled api instance", async () => {
    const body = {
      provider: "gsc",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
    };
    api.post.mockResolvedValueOnce({ data: { success: true, data: { status: "success" } } });

    await syncAnalyticsProvider(body);

    expect(api.post).toHaveBeenCalledWith("/admin/analytics/sync", body);
  });
});
