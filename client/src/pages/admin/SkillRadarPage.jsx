import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";

import SEO from "../../components/SEO";
import { skillRadarQueryOptions } from "../../queries/skillRadar.queries";
import SkillRadarDetailDrawer from "./skill-radar/SkillRadarDetailDrawer";
import SkillRadarSummary from "./skill-radar/SkillRadarSummary";
import SkillRadarTable from "./skill-radar/SkillRadarTable";
import { filterSkillRadarItems } from "./skill-radar/skillRadarPresentation";

const selectClassName = "min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 transition hover:border-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";
const EMPTY_ITEMS = [];

export default function SkillRadarPage() {
  const query = useQuery(skillRadarQueryOptions());
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const [drift, setDrift] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);

  const items = query.data?.items || EMPTY_ITEMS;
  const domains = useMemo(
    () => [...new Set(items.map((item) => item.domain))].sort((a, b) => a.localeCompare(b, "vi")),
    [items],
  );
  const filteredItems = useMemo(
    () => filterSkillRadarItems(items, { search, domain, lifecycle, drift }),
    [items, search, domain, lifecycle, drift],
  );
  const closeDetail = useCallback(() => setSelectedItem(null), []);

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <SEO title="Radar công nghệ" noindex />
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">Radar công nghệ</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Theo dõi upstream Agent Skill, phát hiện drift và giữ mọi quyết định học hỏi có provenance. Dashboard không tự cài hoặc sửa skill của project.</p>
        </header>

        {query.isLoading && <section className="rounded-xl border border-zinc-200 bg-white p-5" aria-live="polite"><div className="h-5 w-48 animate-pulse rounded bg-zinc-200 motion-reduce:animate-none" /><div className="mt-4 h-20 animate-pulse rounded bg-zinc-100 motion-reduce:animate-none" /><p className="sr-only">Đang tải Radar công nghệ...</p></section>}

        {query.isError && <section className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert"><h2 className="font-bold text-rose-950">Không thể tải Radar công nghệ</h2><p className="mt-1 text-sm text-rose-800">Kiểm tra lại kết nối hoặc thử tải lại dữ liệu.</p><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />Thử lại</button></section>}

        {query.data && <>
          <SkillRadarSummary summary={query.data.summary} schedule={query.data.schedule} />

          <section className="flex flex-col gap-3 border-y border-zinc-200 py-4 xl:flex-row xl:items-end" aria-label="Bộ lọc Radar công nghệ">
            <label className="relative min-w-0 flex-1"><span className="text-xs font-semibold text-zinc-600">Tìm nguồn</span><Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-zinc-400" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên skill, repo hoặc local target" className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" /></label>
            <label><span className="block text-xs font-semibold text-zinc-600">Lĩnh vực</span><select value={domain} onChange={(event) => setDomain(event.target.value)} className={`mt-1 ${selectClassName}`}><option value="all">Tất cả</option>{domains.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span className="block text-xs font-semibold text-zinc-600">Lifecycle</span><select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className={`mt-1 ${selectClassName}`}><option value="all">Tất cả</option><option value="active">Đang theo dõi</option><option value="candidate">Ứng viên</option><option value="watch">Theo dõi chậm</option><option value="dormant">Ngủ đông</option><option value="archived">Đã lưu trữ</option><option value="rejected">Đã loại</option></select></label>
            <label><span className="block text-xs font-semibold text-zinc-600">Drift</span><select value={drift} onChange={(event) => setDrift(event.target.value)} className={`mt-1 ${selectClassName}`}><option value="all">Tất cả</option><option value="changed">Có thay đổi</option><option value="review_due">Đến hạn review</option><option value="rate_limited">Giới hạn GitHub API</option><option value="clean">Đã đồng bộ</option><option value="audit_warning">Cảnh báo audit</option><option value="unreachable">Không truy cập được</option></select></label>
          </section>

          {filteredItems.length > 0 ? <SkillRadarTable items={filteredItems} nextRunAt={query.data.schedule.nextRunAt} onSelect={setSelectedItem} /> : <section className="rounded-xl border border-zinc-200 bg-white p-8 text-center"><h2 className="font-bold text-zinc-950">Không có nguồn phù hợp</h2><p className="mt-2 text-sm text-zinc-600">Thử đổi từ khóa hoặc bộ lọc hiện tại.</p></section>}
        </>}
      </div>
      <SkillRadarDetailDrawer item={selectedItem} onClose={closeDetail} />
    </main>
  );
}
