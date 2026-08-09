import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

const number = new Intl.NumberFormat("vi-VN");

export default function AnalyticsDetailDrawer({ slug, query, onClose }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!slug) return undefined;
    const previousFocus = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [slug, onClose]);

  if (!slug) return null;
  const data = query.data;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-zinc-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="analytics-detail-title" className="relative z-50 h-full w-full max-w-2xl overflow-y-auto bg-zinc-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Chi tiết Blog</p>
            <h2 id="analytics-detail-title" className="mt-1 text-lg font-bold text-zinc-950">{data?.blog?.title || slug}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Đóng chi tiết Blog" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><X className="size-5" /></button>
        </div>

        <div className="space-y-6 p-5">
          {query.isLoading && <div className="animate-pulse space-y-3" aria-label="Đang tải chi tiết Blog"><div className="h-24 rounded-xl bg-zinc-200" /><div className="h-40 rounded-xl bg-zinc-200" /></div>}
          {query.isError && (
            <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900" role="alert"><AlertCircle className="size-5 shrink-0" /><div><p className="font-semibold">Không thể tải chi tiết</p><button type="button" onClick={() => query.refetch()} className="mt-2 min-h-11 text-sm font-semibold underline underline-offset-4 transition hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">Thử lại</button></div></div>
          )}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
                {[
                  ["Users", data.funnel.activeUsers],
                  ["Đọc kỹ", data.funnel.engagedReads],
                  ["CTA", data.funnel.ctaClicks],
                  ["Lead", data.funnel.leads],
                  ["Đánh giá", data.funnel.assessments],
                  ["Khách hàng", data.funnel.customers],
                ].map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-2 text-xl font-bold text-zinc-950">{number.format(value || 0)}</p></div>)}
              </div>

              <section aria-labelledby="detail-trend-title">
                <h3 id="detail-trend-title" className="font-bold text-zinc-950">Xu hướng theo ngày</h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {data.trend.length === 0 ? <p className="p-4 text-sm text-zinc-600">Chưa có dữ liệu xu hướng.</p> : data.trend.map((item) => (
                    <div key={item.dateKey} className="grid grid-cols-2 gap-2 border-b border-zinc-100 px-4 py-3 text-sm last:border-0 sm:grid-cols-4"><span className="font-medium text-zinc-700">{item.dateKey}</span><span className="text-right">{number.format(item.clicks)} nhấp</span><span className="text-right">{number.format(item.activeUsers)} users</span><span className="text-right text-emerald-700">{number.format(item.engagedReads)} đọc kỹ</span></div>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section aria-labelledby="detail-query-title"><h3 id="detail-query-title" className="font-bold text-zinc-950">Top từ khóa</h3><div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">{data.queries.length === 0 ? <p className="p-4 text-sm text-zinc-600">Chưa có từ khóa.</p> : data.queries.map((item) => <div key={item.query} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="min-w-0 break-words text-zinc-800">{item.query}</span><span className="shrink-0 font-semibold tabular-nums">{number.format(item.clicks)}</span></div>)}</div></section>
                <section aria-labelledby="detail-source-title"><h3 id="detail-source-title" className="font-bold text-zinc-950">Nguồn / thiết bị</h3><div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">{[...data.sources, ...data.devices].length === 0 ? <p className="p-4 text-sm text-zinc-600">Chưa có breakdown.</p> : [...data.sources, ...data.devices].map((item) => <div key={item.key} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="min-w-0 break-words text-zinc-800">{item.key}</span><span className="shrink-0 font-semibold tabular-nums">{number.format(item.activeUsers)}</span></div>)}</div></section>
              </div>

              <p className="text-xs text-zinc-500">Lượt xem cũ: {number.format(data.blog.legacyViews || 0)} request detail — không phải unique users.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
