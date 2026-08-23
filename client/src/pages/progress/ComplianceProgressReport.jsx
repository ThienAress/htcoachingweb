import { progressMetricRows } from "./progressPresentation";
import { ProgressSectionHeader } from "./ProgressSectionHeader";

const AXIS_TICKS = [0, 25, 50, 75, 100];

export const ComplianceProgressReport = ({
  compliance,
  headingRef,
  onBack,
  rangeControls,
}) => {
  const rows = progressMetricRows(compliance);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="compliance-progress-title"
      data-progress-section-card="compliance"
    >
      <ProgressSectionHeader
        title="Mức độ thực hiện"
        titleId="compliance-progress-title"
        description="So sánh mức hoàn thành những nội dung thực sự được áp dụng trong khoảng đang xem."
        headingRef={headingRef}
        onBack={onBack}
        rangeControls={rangeControls}
      />

      <figure
        className="px-5 py-5 sm:px-6 sm:py-6"
        aria-labelledby="compliance-chart-title"
        data-compliance-chart="true"
      >
        <h3 id="compliance-chart-title" className="sr-only">
          Biểu đồ phần trăm thực hiện
        </h3>
        <div className="hidden grid-cols-[minmax(150px,0.9fr)_minmax(240px,2fr)_auto] items-end gap-4 pb-2 sm:grid">
          <span />
          <div className="flex justify-between text-xs tabular-nums text-slate-500">
            {AXIS_TICKS.map((tick) => (
              <span key={tick}>{tick}%</span>
            ))}
          </div>
          <span className="min-w-24" />
        </div>
        <div className="divide-y divide-slate-800">
          {rows.map((row) => {
            const hasValue = row.percent !== null && row.percent !== undefined;
            const percent = hasValue
              ? Math.max(0, Math.min(100, Number(row.percent)))
              : null;
            return (
              <div
                key={row.key}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(150px,0.9fr)_minmax(240px,2fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="flex items-center justify-between gap-3 sm:block">
                  <h3 className="text-sm font-semibold text-slate-200">
                    {row.label}
                  </h3>
                  <span className="text-xs font-semibold tabular-nums text-slate-400 sm:hidden">
                    {hasValue
                      ? `${row.displayPercent} · ${row.numerator}/${row.denominator}`
                      : "Chưa áp dụng"}
                  </span>
                </div>
                {hasValue ? (
                  <div
                    className="h-3 w-full overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.label}: ${row.displayPercent}, ${row.numerator} trên ${row.denominator}`}
                  >
                    <div
                      className="h-full rounded-full bg-orange-400 transition-[width] duration-200"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                ) : (
                  <div
                    className="h-3 w-full rounded-full bg-slate-800"
                    aria-hidden="true"
                  />
                )}
                <span className="hidden min-w-24 text-right text-sm font-bold tabular-nums text-white sm:block">
                  {hasValue
                    ? `${row.displayPercent} · ${row.numerator}/${row.denominator}`
                    : "Chưa áp dụng"}
                </span>
              </div>
            );
          })}
        </div>
        <figcaption className="mt-4 text-xs leading-5 text-slate-500">
          Phần trăm chỉ tính những lịch, kế hoạch hoặc thói quen thực sự áp dụng;
          mục chưa áp dụng không bị tính thành 0%.
        </figcaption>
      </figure>
    </section>
  );
};
