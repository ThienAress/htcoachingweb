import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, RefreshCw } from "lucide-react";

import SEO from "../../components/SEO";
import { useDebounce } from "../../hooks/useDebounce";
import {
  analyticsBlogDetailQueryOptions,
  analyticsBlogQueryOptions,
  analyticsKeywordQueryOptions,
  analyticsOverviewQueryOptions,
  analyticsProvidersQueryOptions,
} from "../../queries/seoAnalytics.queries";
import { adminQueryKeys } from "../../queries/queryKeys";
import { invalidateByKey } from "../../queries/invalidation";
import { syncAnalyticsProvider } from "../../services/seoAnalytics.service";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/vietnamDate";
import AnalyticsDetailDrawer from "./seo-analytics/AnalyticsDetailDrawer";
import AnalyticsOverview from "./seo-analytics/AnalyticsOverview";
import BlogPerformanceTable from "./seo-analytics/BlogPerformanceTable";
import KeywordPerformanceTable from "./seo-analytics/KeywordPerformanceTable";

const presetRange = (days) => {
  const endDate = getVietnamDateKey();
  return { startDate: addDaysToDateKey(endDate, -(days - 1)), endDate };
};

const healthStyle = {
  ready: "bg-emerald-50 text-emerald-800",
  stale: "bg-amber-50 text-amber-900",
  partial: "bg-cyan-50 text-cyan-900",
  error: "bg-rose-50 text-rose-900",
  not_configured: "bg-zinc-100 text-zinc-700",
  never_synced: "bg-zinc-100 text-zinc-700",
};
const healthText = {
  ready: "Sẵn sàng",
  stale: "Dữ liệu cũ",
  partial: "Một phần",
  error: "Lỗi đồng bộ",
  not_configured: "Chưa cấu hình",
  never_synced: "Chưa đồng bộ",
};

export default function SeoAnalyticsPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState(() => presetRange(28));
  const [activeTab, setActiveTab] = useState("overview");
  const [blogPage, setBlogPage] = useState(1);
  const [keywordPage, setKeywordPage] = useState(1);
  const [blogSearch, setBlogSearch] = useState("");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [blogSort, setBlogSort] = useState("clicks");
  const [blogDirection, setBlogDirection] = useState("desc");
  const [selectedSlug, setSelectedSlug] = useState("");
  const debouncedBlogSearch = useDebounce(blogSearch, 300);
  const debouncedKeywordSearch = useDebounce(keywordSearch, 300);
  const validRange = range.startDate <= range.endDate;

  const baseFilters = useMemo(() => range, [range]);
  const blogFilters = useMemo(
    () => ({ ...range, page: blogPage, limit: 20, search: debouncedBlogSearch, sort: blogSort, direction: blogDirection }),
    [range, blogPage, debouncedBlogSearch, blogSort, blogDirection],
  );
  const keywordFilters = useMemo(
    () => ({ ...range, page: keywordPage, limit: 20, search: debouncedKeywordSearch, sort: "clicks", direction: "desc" }),
    [range, keywordPage, debouncedKeywordSearch],
  );

  const overviewQuery = useQuery({ ...analyticsOverviewQueryOptions(baseFilters), enabled: validRange });
  const providersQuery = useQuery(analyticsProvidersQueryOptions());
  const blogQuery = useQuery({ ...analyticsBlogQueryOptions(blogFilters), enabled: validRange && activeTab === "blogs" });
  const keywordQuery = useQuery({ ...analyticsKeywordQueryOptions(keywordFilters), enabled: validRange && activeTab === "keywords" });
  const detailQuery = useQuery({ ...analyticsBlogDetailQueryOptions({ slug: selectedSlug, ...range }), enabled: Boolean(selectedSlug) && validRange });
  const syncMutation = useMutation({
    mutationFn: (provider) => syncAnalyticsProvider({ provider, ...range }),
    onSuccess: async () => invalidateByKey(queryClient, adminQueryKeys.seoAnalytics.all()),
  });

  const applyPreset = (days) => {
    setRange(presetRange(days));
    setBlogPage(1);
    setKeywordPage(1);
  };
  const closeDetail = useCallback(() => setSelectedSlug(""), []);

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <SEO title="SEO & Conversion Analytics" noindex />
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-emerald-700">SEO & Conversion Analytics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">Nội dung nào tạo ra khách hàng?</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Đối chiếu GSC, GA4 và lead nghiệp vụ. Khách truy cập GA4 là browser/device activity, không đồng nghĩa tài khoản đã đăng nhập; “Lượt xem cũ” chỉ là request counter.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2" aria-label="Chọn khoảng ngày">
            {[7, 28, 90].map((days) => <button key={days} type="button" onClick={() => applyPreset(days)} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-500 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{days} ngày</button>)}
            <label className="text-xs font-medium text-zinc-600">Từ<input type="date" value={range.startDate} max={range.endDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 block min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" /></label>
            <label className="text-xs font-medium text-zinc-600">Đến<input type="date" value={range.endDate} min={range.startDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 block min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" /></label>
          </div>
        </header>

        {!validRange && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</div>}

        <section className="rounded-xl border border-zinc-200 bg-white p-4" aria-labelledby="provider-status-heading">
          <div className="flex items-center gap-2"><CalendarDays className="size-5 text-cyan-700" aria-hidden="true" /><h2 id="provider-status-heading" className="font-bold text-zinc-950">Trạng thái nguồn dữ liệu</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {providersQuery.isLoading && <p className="text-sm text-zinc-600">Đang kiểm tra provider...</p>}
            {providersQuery.isError && <button type="button" onClick={() => providersQuery.refetch()} className="min-h-11 text-left text-sm font-semibold text-rose-700 underline underline-offset-4 transition hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">Không thể tải trạng thái — thử lại</button>}
            {(providersQuery.data || []).map((provider) => (
              <div key={provider.provider} className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 first:border-0 first:pt-0 md:border-0 md:pt-0">
                <div><div className="flex items-center gap-2"><strong className="uppercase text-zinc-950">{provider.provider}</strong><span className={`rounded-md px-2 py-1 text-xs font-semibold ${healthStyle[provider.health] || healthStyle.never_synced}`}>{healthText[provider.health] || provider.health}</span></div><p className="mt-1 text-xs text-zinc-500">{provider.lastSyncedAt ? `Cập nhật: ${new Date(provider.lastSyncedAt).toLocaleString("vi-VN")}` : "Chưa có lần đồng bộ thành công"}</p></div>
                <button type="button" disabled={!validRange || provider.health === "not_configured" || syncMutation.isPending} onClick={() => syncMutation.mutate(provider.provider)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-500 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin motion-reduce:animate-none" : ""}`} />Đồng bộ</button>
              </div>
            ))}
          </div>
          {syncMutation.isError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{syncMutation.error?.response?.data?.message || "Không thể đồng bộ provider."}</p>}
        </section>

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Khu vực analytics">
          {[["overview", "Tổng quan"], ["blogs", "Bài Blog"], ["keywords", "Từ khóa"]].map(([key, label]) => <button key={key} type="button" onClick={() => setActiveTab(key)} aria-current={activeTab === key ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${activeTab === key ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-600 hover:text-zinc-950"}`}>{label}</button>)}
        </nav>

        {activeTab === "overview" && <AnalyticsOverview query={overviewQuery} />}
        {activeTab === "blogs" && <BlogPerformanceTable query={blogQuery} search={blogSearch} onSearch={(value) => { setBlogSearch(value); setBlogPage(1); }} sort={blogSort} direction={blogDirection} onSort={(nextSort, nextDirection) => { setBlogSort(nextSort); setBlogDirection(nextDirection); setBlogPage(1); }} page={blogPage} onPage={setBlogPage} onOpen={setSelectedSlug} />}
        {activeTab === "keywords" && <KeywordPerformanceTable query={keywordQuery} search={keywordSearch} onSearch={(value) => { setKeywordSearch(value); setKeywordPage(1); }} page={keywordPage} onPage={setKeywordPage} />}
      </div>
      <AnalyticsDetailDrawer slug={selectedSlug} query={detailQuery} onClose={closeDetail} />
    </main>
  );
}
