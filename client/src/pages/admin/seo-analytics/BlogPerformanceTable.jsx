import { AlertCircle, ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";

const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });

const LoadingRows = () =>
  Array.from({ length: 5 }, (_, index) => (
    <tr key={index} className="animate-pulse border-b border-zinc-100">
      <td colSpan="9" className="px-4 py-5"><div className="h-4 rounded bg-zinc-100" /></td>
    </tr>
  ));

export default function BlogPerformanceTable({
  query,
  search,
  onSearch,
  sort,
  direction,
  onSort,
  page,
  onPage,
  onOpen,
}) {
  const data = query.data;
  const items = data?.items || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const sortValue = `${sort}:${direction}`;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-labelledby="blog-performance-heading">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="blog-performance-heading" className="font-bold text-zinc-950">Hiệu quả bài Blog</h2>
          <p className="mt-1 text-sm text-zinc-600">GA4, GSC và lead DB được hiển thị thành cột riêng.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <span className="sr-only">Tìm bài Blog</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Tìm bài viết"
              className="min-h-11 w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 sm:w-52"
            />
          </label>
          <label>
            <span className="sr-only">Sắp xếp Blog</span>
            <select
              value={sortValue}
              onChange={(event) => {
                const [nextSort, nextDirection] = event.target.value.split(":");
                onSort(nextSort, nextDirection);
              }}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="clicks:desc">Nhấp cao nhất</option>
              <option value="activeUsers:desc">Người đọc cao nhất</option>
              <option value="leads:desc">Lead cao nhất</option>
              <option value="publishedAt:desc">Mới xuất bản</option>
              <option value="legacyViews:desc">Lượt xem cũ</option>
            </select>
          </label>
        </div>
      </div>

      {query.isError ? (
        <div className="flex items-start gap-3 p-6 text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 size-5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Không thể tải bảng Blog</p>
            <button type="button" onClick={() => query.refetch()} className="mt-2 min-h-11 text-sm font-semibold text-rose-700 underline underline-offset-4 transition hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">Thử lại</button>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Bài viết</th>
                  <th className="px-3 py-3 text-right">GSC nhấp</th>
                  <th className="px-3 py-3 text-right">Hiển thị</th>
                  <th className="px-3 py-3 text-right">GA users</th>
                  <th className="px-3 py-3 text-right">Đọc kỹ</th>
                  <th className="px-3 py-3 text-right">CTA</th>
                  <th className="px-3 py-3 text-right">Lead</th>
                  <th className="px-3 py-3 text-right" title="Số request detail cũ, không phải unique users">Lượt xem cũ</th>
                  <th className="px-4 py-3"><span className="sr-only">Chi tiết</span></th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? <LoadingRows /> : items.map((item) => (
                  <tr key={item.slug} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="max-w-xs px-4 py-4">
                      <p className="truncate font-semibold text-zinc-950">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.category}</p>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.clicks)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.impressions)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.activeUsers)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.engagedReads)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.ctaClicks)}</td>
                    <td className="px-3 py-4 text-right font-semibold tabular-nums text-emerald-700">{number.format(item.leads)}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-zinc-500">{number.format(item.legacyViews)}</td>
                    <td className="px-4 py-4 text-right">
                      <button type="button" onClick={() => onOpen(item.slug)} aria-label={`Xem chi tiết ${item.title}`} className="inline-flex size-11 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><Eye className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!query.isLoading && items.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-zinc-600">Không có bài Blog phù hợp trong khoảng ngày này.</div>
          )}

          <div className="divide-y divide-zinc-100 md:hidden">
            {query.isLoading && Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="animate-pulse p-4" aria-hidden="true">
                <div className="h-4 w-3/4 rounded bg-zinc-100" />
                <div className="mt-3 h-10 rounded bg-zinc-100" />
              </div>
            ))}
            {items.map((item) => (
              <button key={item.slug} type="button" onClick={() => onOpen(item.slug)} className="w-full p-4 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600">
                <p className="font-semibold text-zinc-950">{item.title}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-zinc-600">
                  <span>Nhấp <strong className="block text-sm text-zinc-950">{number.format(item.clicks)}</strong></span>
                  <span>Users <strong className="block text-sm text-zinc-950">{number.format(item.activeUsers)}</strong></span>
                  <span>Lead <strong className="block text-sm text-emerald-700">{number.format(item.leads)}</strong></span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">CTR {percent.format(item.ctr || 0)} · Lượt xem cũ {number.format(item.legacyViews)}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>Trang {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1 || query.isFetching} aria-label="Trang Blog trước" className="inline-flex size-11 items-center justify-center rounded-lg border border-zinc-300 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages || query.isFetching} aria-label="Trang Blog sau" className="inline-flex size-11 items-center justify-center rounded-lg border border-zinc-300 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
