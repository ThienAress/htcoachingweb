import { Activity } from "lucide-react";

import { ProgressWellnessOverview } from "./ProgressWellnessOverview";
import { WeightTrendChart } from "./WeightTrendChart";
import {
  progressMetricRows,
  summarizeProgressAvailability,
} from "./progressPresentation";

const STATUS_COLORS = {
  high: { bar: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10" },
  mid: { bar: "bg-orange-400", text: "text-orange-300", bg: "bg-orange-400/10" },
  low: { bar: "bg-rose-400", text: "text-rose-300", bg: "bg-rose-400/10" },
  none: { bar: "bg-slate-700", text: "text-slate-400", bg: "bg-slate-800" },
};

const getStatusKey = (percent) => {
  if (percent === null) return "none";
  if (percent >= 80) return "high";
  if (percent >= 40) return "mid";
  return "low";
};

const MetricGrid = ({ compliance }) => {
  const rows = progressMetricRows(compliance);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-400/10">
          <Activity className="h-4 w-4 text-orange-300" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-50">Mức độ thực hiện</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Chỉ tính lịch, kế hoạch và thói quen thực sự áp dụng.
          </p>
        </div>
      </div>

      {/* Metric rows */}
      <div className="divide-y divide-slate-800">
        {rows.map((row) => {
          const statusKey = getStatusKey(row.percent);
          const colors = STATUS_COLORS[statusKey];
          return (
            <div
              key={row.key}
              className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(160px,0.8fr)_minmax(220px,2fr)_auto] sm:items-center sm:gap-4"
            >
              {/* Label */}
              <h3 className="text-sm font-semibold text-slate-200">
                {row.label}
              </h3>

              {/* Progress bar */}
              <div>
                {row.percent === null ? (
                  <p className="text-xs text-slate-400">
                    Chưa áp dụng trong khoảng này
                  </p>
                ) : (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-[width] duration-200`}
                      style={{ width: `${row.percent}%` }}
                      role="progressbar"
                      aria-valuenow={row.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${row.label}: ${row.displayPercent}`}
                    />
                  </div>
                )}
              </div>

              {/* Value badge */}
              <div className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${colors.bg} ${colors.text}`}>
                {row.percent === null
                  ? "Chưa áp dụng"
                  : `${row.displayPercent} · ${row.numerator}/${row.denominator}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const ProgressSummary = ({ progress }) => (
  <div className="space-y-4">
    {!summarizeProgressAvailability(progress) && (
      <p className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-400">
        Chưa có dữ liệu trong khoảng này. Các chỉ số sẽ xuất hiện khi bạn có lịch hoặc ghi nhật ký.
      </p>
    )}
    <MetricGrid compliance={progress.compliance} />
    <div className="grid gap-4 xl:grid-cols-2">
      <ProgressWellnessOverview wellness={progress.wellness} />
      <WeightTrendChart trend={progress.weightTrend} />
    </div>
  </div>
);
