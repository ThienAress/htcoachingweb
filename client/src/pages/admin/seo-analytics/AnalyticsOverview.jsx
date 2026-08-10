import { AlertCircle, ArrowDown, CheckCircle2 } from "lucide-react";

const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
});

const metricValue = (key, value) => {
  if (value === null || value === undefined) return "—";
  if (key === "ctr") return percent.format(value || 0);
  if (key === "position") return Number(value || 0).toFixed(1);
  return number.format(value || 0);
};

const KPI_DEFINITIONS = [
  { key: "impressions", label: "Lượt hiển thị", source: "GSC" },
  { key: "clicks", label: "Nhấp từ tìm kiếm", source: "GSC" },
  { key: "ctr", label: "CTR", source: "GSC" },
  { key: "position", label: "Vị trí trung bình", source: "GSC" },
  { key: "activeUsers", label: "Khách truy cập GA4", source: "GA4" },
  { key: "returningUsers", label: "Khách quay lại GA4", source: "GA4" },
  { key: "engagedReads", label: "Đọc có tương tác", source: "GA4" },
  { key: "leads", label: "Lead thành công", source: "DB" },
  { key: "assessments", label: "Đã đánh giá", source: "DB" },
  { key: "customers", label: "Thành khách hàng", source: "DB" },
];

const Loading = () => (
  <div className="animate-pulse space-y-5" aria-label="Đang tải tổng quan analytics">
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4">
      {Array.from({ length: KPI_DEFINITIONS.length }, (_, index) => (
        <div key={index} className="h-28 bg-white p-4">
          <div className="h-3 w-20 rounded bg-zinc-200" />
          <div className="mt-4 h-7 w-16 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  </div>
);

export default function AnalyticsOverview({ query }) {
  if (query.isLoading) return <Loading />;
  if (query.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-950" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Không thể tải số liệu tổng quan</p>
            <p className="mt-1 text-sm text-rose-800">Dữ liệu cache vẫn được giữ nguyên. Hãy thử tải lại.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 min-h-11 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const kpis = query.data?.kpis || {};
  const ga4Quality = query.data?.dataQuality?.ga4;
  const hasData = KPI_DEFINITIONS.some(({ key }) => Number(kpis[key]) > 0);
  const funnel = [
    { label: "Khách truy cập GA4", value: kpis.activeUsers || 0 },
    { label: "Đọc có tương tác", value: kpis.engagedReads || 0 },
    { label: "Nhấp CTA", value: kpis.ctaClicks || 0 },
    { label: "Lead DB", value: kpis.leads || 0 },
    { label: "Đã đánh giá", value: kpis.assessments || 0 },
    { label: "Thành khách hàng", value: kpis.customers || 0 },
  ];
  const maximum = Math.max(...funnel.map(({ value }) => value), 1);

  return (
    <div className="space-y-6">
      {!hasData && (
        <div className="flex items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Chưa có aggregate trong khoảng ngày này</p>
            <p className="mt-1 text-sm text-cyan-800">Cấu hình provider rồi đồng bộ, hoặc chọn khoảng ngày khác.</p>
          </div>
        </div>
      )}

      {ga4Quality?.windowAggregate === "unavailable" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Chưa có aggregate GA4 chính xác cho khoảng ngày này</p>
            <p className="mt-1 text-sm text-amber-800">Hệ thống không cộng lượt khách theo từng ngày vì cách đó có thể đếm trùng. Hãy đồng bộ lại GA4 cho đúng khoảng đã chọn.</p>
          </div>
        </div>
      )}

      <section aria-labelledby="analytics-kpi-heading">
        <h2 id="analytics-kpi-heading" className="sr-only">Chỉ số tổng quan</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4">
          {KPI_DEFINITIONS.map(({ key, label, source }) => (
            <div key={key} className="bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-600">{label}</p>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">{source}</span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">
                {metricValue(key, kpis[key])}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5" aria-labelledby="analytics-funnel-heading">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="analytics-funnel-heading" className="text-base font-bold text-zinc-950">Funnel nội dung → lead</h2>
            <p className="mt-1 text-sm text-zinc-600">Mỗi bước giữ nguyên nguồn canonical; không coi GA event là lead DB.</p>
          </div>
          <ArrowDown className="size-5 text-emerald-600" aria-hidden="true" />
        </div>
        <div className="mt-5 space-y-4">
          {funnel.map(({ label, value }) => (
            <div key={label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700">{label}</span>
                <span className="font-semibold tabular-nums text-zinc-950">{number.format(value)}</span>
              </div>
              <progress
                value={value}
                max={maximum}
                aria-label={`${label}: ${number.format(value)}`}
                className="h-2 w-full overflow-hidden rounded-full accent-emerald-600"
              />
            </div>
          ))}
        </div>
        {(kpis.unattributedAssessments > 0 || kpis.unattributedCustomers > 0) && (
          <p className="mt-4 text-xs leading-5 text-amber-800">
            Chưa gắn nguồn: {number.format(kpis.unattributedAssessments || 0)} hồ sơ đánh giá và {" "}
            {number.format(kpis.unattributedCustomers || 0)} khách hàng. Hệ thống không tự ghép bằng email hoặc số điện thoại.
          </p>
        )}
      </section>
    </div>
  );
}
