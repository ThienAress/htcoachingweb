import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";

const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });

const labelStyle = {
  opportunity: "bg-cyan-50 text-cyan-800",
  declining: "bg-rose-50 text-rose-800",
  cannibalization: "bg-amber-50 text-amber-900",
};
const labelText = {
  opportunity: "Cơ hội",
  declining: "Đang giảm",
  cannibalization: "Trùng trang",
};

export default function KeywordPerformanceTable({ query, search, onSearch, page, onPage }) {
  const items = query.data?.items || [];
  const totalPages = query.data?.pagination?.totalPages || 1;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-labelledby="keyword-performance-heading">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="keyword-performance-heading" className="font-bold text-zinc-950">Từ khóa tìm kiếm</h2>
          <p className="mt-1 text-sm text-zinc-600">GSC chỉ cung cấp top rows, không phải raw search log đầy đủ.</p>
        </div>
        <label className="relative">
          <span className="sr-only">Tìm từ khóa</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Tìm từ khóa" className="min-h-11 w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 sm:w-64" />
        </label>
      </div>

      {query.isError ? (
        <div className="flex items-start gap-3 p-6 text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 size-5" aria-hidden="true" />
          <div><p className="font-semibold">Không thể tải từ khóa</p><button type="button" onClick={() => query.refetch()} className="mt-2 min-h-11 text-sm font-semibold text-rose-700 underline underline-offset-4 transition hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">Thử lại</button></div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr><th className="px-4 py-3">Từ khóa</th><th className="px-3 py-3">Trang xếp hạng</th><th className="px-3 py-3 text-right">Nhấp</th><th className="px-3 py-3 text-right">Hiển thị</th><th className="px-3 py-3 text-right">CTR</th><th className="px-3 py-3 text-right">Vị trí</th><th className="px-4 py-3">Tín hiệu</th></tr>
              </thead>
              <tbody>
                {query.isLoading ? Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} className="animate-pulse border-b border-zinc-100"><td colSpan="7" className="px-4 py-5"><div className="h-4 rounded bg-zinc-100" /></td></tr>
                )) : items.map((item) => (
                  <tr key={item.query} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="max-w-xs px-4 py-4 font-semibold text-zinc-950">{item.query}</td>
                    <td className="max-w-xs truncate px-3 py-4 text-xs text-zinc-600" title={item.rankingPage}>{item.rankingPage}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.clicks)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{number.format(item.impressions)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{percent.format(item.ctr || 0)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{Number(item.position || 0).toFixed(1)}</td>
                    <td className="px-4 py-4">{item.label ? <span className={`rounded-md px-2 py-1 text-xs font-semibold ${labelStyle[item.label]}`}>{labelText[item.label]}</span> : <span className="text-zinc-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-zinc-100 md:hidden">
            {query.isLoading && Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="animate-pulse p-4" aria-hidden="true">
                <div className="h-4 w-3/4 rounded bg-zinc-100" />
                <div className="mt-3 h-14 rounded bg-zinc-100" />
              </div>
            ))}
            {items.map((item) => (
              <article key={item.query} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words font-semibold text-zinc-950">{item.query}</h3>
                  {item.label && <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${labelStyle[item.label]}`}>{labelText[item.label]}</span>}
                </div>
                <p className="mt-1 break-all text-xs text-zinc-500">{item.rankingPage}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-zinc-600">
                  <div><dt>Nhấp</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-950">{number.format(item.clicks)}</dd></div>
                  <div><dt>Hiển thị</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-950">{number.format(item.impressions)}</dd></div>
                  <div><dt>CTR</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-950">{percent.format(item.ctr || 0)}</dd></div>
                  <div><dt>Vị trí</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-950">{Number(item.position || 0).toFixed(1)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          {!query.isLoading && items.length === 0 && <div className="px-6 py-12 text-center text-sm text-zinc-600">Chưa có từ khóa trong khoảng ngày này.</div>}
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>Trang {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1 || query.isFetching} aria-label="Trang từ khóa trước" className="inline-flex size-11 items-center justify-center rounded-lg border border-zinc-300 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages || query.isFetching} aria-label="Trang từ khóa sau" className="inline-flex size-11 items-center justify-center rounded-lg border border-zinc-300 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
